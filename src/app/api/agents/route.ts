import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import * as net from "net";

/** Returns true if a TCP connection to host:port succeeds within timeoutMs */
function tcpProbe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (result: boolean) => {
      if (!settled) { settled = true; socket.destroy(); resolve(result); }
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));
    socket.connect(port, host);
  });
}

export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  name?: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  dmPolicy?: string;
  allowAgents?: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: "online" | "offline";
  lastActivity?: string;
  activeSessions: number;
}

// Fallback config used when an agent doesn't define its own ui config in openclaw.json.
// The main agent reads name/emoji from env vars; all others fall back to generic defaults.
// Override via each agent's openclaw.json → ui.emoji / ui.color / name fields.
const DEFAULT_AGENT_CONFIG: Record<string, { emoji: string; color: string; name?: string }> = {
  main: {
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
    color: "#ff6b35",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
  },
};

/**
 * Get agent display info (emoji, color, name) from openclaw.json or defaults
 */
function getAgentDisplayInfo(agentId: string, agentConfig: any): { emoji: string; color: string; name: string } {
  // First try to get from agent's own config in openclaw.json
  const configEmoji = agentConfig?.ui?.emoji;
  const configColor = agentConfig?.ui?.color;
  const configName = agentConfig?.name;

  // Then try defaults
  const defaults = DEFAULT_AGENT_CONFIG[agentId];

  return {
    emoji: configEmoji || defaults?.emoji || "🤖",
    color: configColor || defaults?.color || "#666666",
    name: configName || defaults?.name || agentId,
  };
}

export async function GET() {
  try {
    const dirsEnv = process.env.OPENCLAW_DIRS || process.env.OPENCLAW_DIR || "/root/.openclaw";
    const openclawDirs = dirsEnv.split(",").map((d) => d.trim()).filter(Boolean);

    const allAgents: Agent[] = [];

    for (const openclawDir of openclawDirs) {
      let config: any;
      try {
        const configPath = openclawDir + "/openclaw.json";
        config = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch (e) {
        console.error(`Failed to read config from ${openclawDir}:`, e);
        continue;
      }

      const defaultWorkspace = config.agents?.defaults?.workspace || openclawDir + "/workspace";

      // Gateway port for this dir — use TCP probe for reliable online detection
      const gatewayPort: number | null = config.server?.port || null;
      const gatewayOnline = gatewayPort ? await tcpProbe("127.0.0.1", gatewayPort) : false;

      // Get agents from config
      const dirAgents: Agent[] = (config.agents?.list || []).map((agent: any) => {
        // Note: gatewayOnline is resolved above per-dir (not per-agent) — all agents in this dir share the same gateway
        const agentInfo = getAgentDisplayInfo(agent.id, agent);

        // Get telegram account info
        const telegramAccount =
          config.channels?.telegram?.accounts?.[agent.id];
        const botToken = telegramAccount?.botToken;

        // Resolve workspace — agent-level takes priority, then defaults, then fallback
        const resolvedWorkspace = agent.workspace || defaultWorkspace;

        // Online = gateway TCP port is responding (authoritative)
        // lastActivity = most recent memory file mtime (informational only)
        const status: "online" | "offline" = gatewayOnline ? "online" : "offline";
        let lastActivity: string | undefined;
        try {
          const today = new Date().toISOString().split("T")[0];
          const memoryFile = join(resolvedWorkspace, "memory", `${today}.md`);
          const stat = require("fs").statSync(memoryFile);
          lastActivity = stat.mtime.toISOString();
        } catch {
          // no memory file today — that's fine
        }

        // Get details of allowed subagents
        const allowAgents = agent.subagents?.allowAgents || [];
        const allowAgentsDetails = allowAgents.map((subagentId: string) => {
          // Find subagent in config
          const subagentConfig = config.agents?.list?.find(
            (a: any) => a.id === subagentId
          );
          if (subagentConfig) {
            const subagentInfo = getAgentDisplayInfo(subagentId, subagentConfig);
            return {
              id: subagentId,
              name: subagentConfig.name || subagentInfo.name,
              emoji: subagentInfo.emoji,
              color: subagentInfo.color,
            };
          }
          // Fallback if subagent not found in config
          const fallbackInfo = getAgentDisplayInfo(subagentId, null);
          return {
            id: subagentId,
            name: fallbackInfo.name,
            emoji: fallbackInfo.emoji,
            color: fallbackInfo.color,
          };
        });

        return {
          id: agent.id,
          name: agent.name || agentInfo.name,
          emoji: agentInfo.emoji,
          color: agentInfo.color,
          model:
            agent.model?.primary || config.agents?.defaults?.model?.primary || "unknown",
          workspace: resolvedWorkspace,
          dmPolicy:
            telegramAccount?.dmPolicy ||
            config.channels?.telegram?.dmPolicy ||
            "pairing",
          allowAgents,
          allowAgentsDetails,
          botToken: botToken ? "configured" : undefined,
          status,
          lastActivity,
          activeSessions: 0, // TODO: get from sessions API
        };
      });

      allAgents.push(...dirAgents);
    }

    return NextResponse.json({ agents: allAgents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json(
      { error: "Failed to load agents" },
      { status: 500 }
    );
  }
}
