import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

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
    // Support multiple openclaw directories via OPENCLAW_DIRS (comma-separated)
    // Fallback to single OPENCLAW_DIR for backwards compatibility
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

      // Get agents from config
      const dirAgents: Agent[] = (config.agents?.list || []).map((agent: any) => {
        const agentInfo = getAgentDisplayInfo(agent.id, agent);

        // Get telegram account info
        const telegramAccount =
          config.channels?.telegram?.accounts?.[agent.id];
        const botToken = telegramAccount?.botToken;

        // Resolve workspace — agent-level takes priority, then defaults, then fallback
        const resolvedWorkspace = agent.workspace || defaultWorkspace;

        // Check if agent has recent activity
        const memoryPath = join(resolvedWorkspace, "memory");
        let lastActivity = undefined;
        let status: "online" | "offline" = "offline";

        try {
          const today = new Date().toISOString().split("T")[0];
          const memoryFile = join(memoryPath, `${today}.md`);
          const stat = require("fs").statSync(memoryFile);
          lastActivity = stat.mtime.toISOString();
          // Consider online if activity within last hour
          status =
            Date.now() - stat.mtime.getTime() < 60 * 60 * 1000
              ? "online"
              : "offline";
        } catch (e) {
          // No recent activity
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
