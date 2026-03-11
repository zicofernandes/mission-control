import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

interface OfficeAgentConfig {
  id: string;
  name?: string;
  workspace?: string;
  ui?: {
    color?: string;
  };
}

interface OfficeRouteConfig {
  agents: {
    list?: OfficeAgentConfig[];
  };
}

interface OfficeAgentDisplayInfo {
  color: string;
  emoji: string;
  name: string;
  role: string;
  workspace: string;
}

export interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: string;
  currentTask: string;
  isActive: boolean;
}

const DEFAULT_AGENT_COLOR = "#666";

export function getOpenclawDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || "/root/.openclaw";
  return dirsEnv.split(",").map((dir) => dir.trim()).filter(Boolean);
}

function getIdentityField(content: string, field: string): string | undefined {
  const match = content.match(new RegExp(`- \\*\\*${field}:\\*\\*\\s+(.+)`));
  return match?.[1]?.trim();
}

function getDefaultWorkspace(openclawDir: string, agentId: string): string {
  return agentId === "main"
    ? join(openclawDir, "workspace")
    : join(openclawDir, `workspace-${agentId}`);
}

function getAgentDisplayInfo(
  agent: OfficeAgentConfig,
  openclawDir: string,
): OfficeAgentDisplayInfo {
  const workspace = agent.workspace || getDefaultWorkspace(openclawDir, agent.id);
  const identityPath = join(workspace, "IDENTITY.md");

  let name = agent.name || agent.id;
  let emoji = "🤖";
  let role = "Agent";

  if (existsSync(identityPath)) {
    try {
      const identity = readFileSync(identityPath, "utf-8");
      name = getIdentityField(identity, "Name") || name;
      emoji = (getIdentityField(identity, "Emoji") || emoji).split(" ")[0];
      role = getIdentityField(identity, "Role") || role;
    } catch {
      // Fall back to config-derived defaults if IDENTITY.md cannot be read.
    }
  }

  return {
    color: agent.ui?.color || DEFAULT_AGENT_COLOR,
    emoji,
    name,
    role,
    workspace,
  };
}

export function getAgentStatusFromFiles(
  workspace: string,
): { isActive: boolean; currentTask: string; lastSeen: number } {
  try {
    const today = new Date().toISOString().split("T")[0];
    const memoryFile = join(workspace, "memory", `${today}.md`);
    const stat = statSync(memoryFile);
    const lastSeen = stat.mtime.getTime();
    const minutesSinceUpdate = (Date.now() - lastSeen) / 1000 / 60;

    const content = readFileSync(memoryFile, "utf-8");
    const lines = content.trim().split("\n").filter((line) => line.trim());

    let currentTask = "Idle...";
    if (lines.length > 0) {
      const lastLine = lines
        .slice(-10)
        .reverse()
        .find((line) => line.length > 20 && !line.match(/^#+\s/));

      if (lastLine) {
        currentTask = lastLine.replace(/^[-*]\s*/, "").slice(0, 100);
        if (lastLine.length > 100) {
          currentTask += "...";
        }
      }
    }

    if (minutesSinceUpdate < 5) {
      return { isActive: true, currentTask: `ACTIVE: ${currentTask}`, lastSeen };
    }

    if (minutesSinceUpdate < 30) {
      return { isActive: false, currentTask: `IDLE: ${currentTask}`, lastSeen };
    }

    return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen };
  } catch {
    return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen: 0 };
  }
}

export function listOfficeAgents(
  env: NodeJS.ProcessEnv = process.env,
  gatewayStatus: Record<
    string,
    { isActive: boolean; currentTask: string; lastSeen: number }
  > = {},
): OfficeAgent[] {
  const agents: OfficeAgent[] = [];

  for (const openclawDir of getOpenclawDirs(env)) {
    const configPath = join(openclawDir, "openclaw.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OfficeRouteConfig;

    for (const agent of config.agents.list || []) {
      const agentInfo = getAgentDisplayInfo(agent, openclawDir);
      const status = gatewayStatus[agent.id] || getAgentStatusFromFiles(agentInfo.workspace);

      agents.push({
        id: agent.id === "freelance" ? "devclaw" : agent.id,
        name: agentInfo.name,
        emoji: agentInfo.emoji,
        color: agentInfo.color,
        role: agentInfo.role,
        currentTask: status.currentTask,
        isActive: status.isActive,
      });
    }
  }

  return agents;
}
