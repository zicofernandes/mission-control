import { readFileSync } from "fs";
import { join } from "path";

interface AgentSession {
  agentId: string;
  sessionId: string;
  label?: string;
  lastActivity?: string;
  createdAt?: string;
}

function getOpenclawDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || "/root/.openclaw";
  return dirsEnv.split(",").map((dir) => dir.trim()).filter(Boolean);
}

export async function getAgentStatusFromGateway(
  env: NodeJS.ProcessEnv = process.env,
  readConfig: typeof readFileSync = readFileSync,
  fetchImpl: typeof fetch = fetch,
): Promise<
  Record<string, { isActive: boolean; currentTask: string; lastSeen: number }>
> {
  const agentStatus: Record<
    string,
    { isActive: boolean; currentTask: string; lastSeen: number }
  > = {};

  for (const openclawDir of getOpenclawDirs(env)) {
    try {
      const configPath = join(openclawDir, "openclaw.json");
      const config = JSON.parse(readConfig(configPath, "utf-8"));
      const gatewayToken = config.gateway?.auth?.token;
      const gatewayPort = config.gateway?.port;

      if (!gatewayToken || !gatewayPort) {
        console.warn("Missing gateway config for:", openclawDir);
        continue;
      }

      const response = await fetchImpl(`http://localhost:${gatewayPort}/api/sessions`, {
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
        },
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        console.warn("Gateway returned non-OK status:", response.status, gatewayPort);
        continue;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Gateway returned non-JSON response:", contentType, gatewayPort);
        continue;
      }

      const sessions = (await response.json()) as AgentSession[];

      for (const session of sessions) {
        if (!session.agentId) continue;

        const lastActivity = session.lastActivity
          ? new Date(session.lastActivity).getTime()
          : 0;
        const minutesAgo = (Date.now() - lastActivity) / 1000 / 60;

        let status = "SLEEPING";
        let currentTask = "zzZ...";

        if (minutesAgo < 5) {
          status = "ACTIVE";
          currentTask = session.label || "Working on task...";
        } else if (minutesAgo < 30) {
          status = "IDLE";
          currentTask = session.label || "Idle...";
        }

        if (
          !agentStatus[session.agentId] ||
          lastActivity > agentStatus[session.agentId].lastSeen
        ) {
          agentStatus[session.agentId] = {
            isActive: status === "ACTIVE",
            currentTask: `${status}: ${currentTask}`,
            lastSeen: lastActivity,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to fetch from gateway:", error);
    }
  }

  return agentStatus;
}
