import { execSync } from "child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

type CronJob = Record<string, unknown>;
type RouteEnv = NodeJS.ProcessEnv;

function getOpenclawDirs(env: RouteEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || "/root/.openclaw";
  return dirsEnv.split(",").map((dir) => dir.trim()).filter(Boolean);
}

function getAgentIdForDir(openclawDir: string, readConfig: typeof readFileSync = readFileSync): string {
  const configPath = path.join(openclawDir, "openclaw.json");
  const config = JSON.parse(readConfig(configPath, "utf-8")) as {
    agents?: { list?: Array<{ id?: string; default?: boolean }> };
  };
  const agents = config.agents?.list || [];
  const defaultAgent = agents.find((agent) => agent.default) || agents[0];

  if (!defaultAgent?.id) {
    throw new Error(`No agent id configured in ${configPath}`);
  }

  return defaultAgent.id;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function listCronJobsAcrossAgents(
  env: RouteEnv = process.env,
  readConfig: typeof readFileSync = readFileSync,
  execCommand: typeof execSync = execSync,
): CronJob[] {
  const jobs: CronJob[] = [];

  for (const openclawDir of getOpenclawDirs(env)) {
    const agentId = getAgentIdForDir(openclawDir, readConfig);
    const output = execCommand(
      `openclaw --profile ${shellQuote(agentId)} cron list --json --all 2>/dev/null`,
      {
        timeout: 10000,
        encoding: "utf-8",
        env: { ...process.env, ...env, OPENCLAW_DIR: openclawDir },
      },
    );

    const data = JSON.parse(output as string) as { jobs?: CronJob[] };
    for (const job of data.jobs || []) {
      jobs.push({ ...job, agentId });
    }
  }

  return jobs;
}
