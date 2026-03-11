import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listCronJobsAcrossAgents } from "./cron-jobs.ts";

function makeTempOpenclawDir(root: string, name: string, agentId: string): string {
  const openclawDir = path.join(root, name);
  fs.mkdirSync(openclawDir, { recursive: true });
  fs.writeFileSync(
    path.join(openclawDir, "openclaw.json"),
    JSON.stringify({
      agents: {
        list: [{ id: agentId, default: true }],
      },
    }),
  );
  return openclawDir;
}

test("listCronJobsAcrossAgents queries every OPENCLAW_DIR and merges jobs with agentId", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-cron-route-"));
  const firstDir = makeTempOpenclawDir(tempRoot, "openclaw-athena", "athena");
  const secondDir = makeTempOpenclawDir(tempRoot, "openclaw-elon", "elon");
  const calls: Array<{ command: string; openclawDir: string | undefined }> = [];

  try {
    const jobs = listCronJobsAcrossAgents(
      { OPENCLAW_DIRS: `${firstDir}, ${secondDir}` },
      fs.readFileSync,
      ((command: string, options?: { env?: NodeJS.ProcessEnv }) => {
        calls.push({ command, openclawDir: options?.env?.OPENCLAW_DIR });

        if (options?.env?.OPENCLAW_DIR === firstDir) {
          return JSON.stringify({
            jobs: [{ id: "job-1", name: "First job" }],
          });
        }

        if (options?.env?.OPENCLAW_DIR === secondDir) {
          return JSON.stringify({
            jobs: [{ id: "job-2", name: "Second job", agentId: "ignored" }],
          });
        }

        throw new Error(`Unexpected OPENCLAW_DIR: ${options?.env?.OPENCLAW_DIR}`);
      }) as typeof import("child_process").execSync,
    );

    assert.deepEqual(calls, [
      {
        command: "openclaw --profile 'athena' cron list --json --all 2>/dev/null",
        openclawDir: firstDir,
      },
      {
        command: "openclaw --profile 'elon' cron list --json --all 2>/dev/null",
        openclawDir: secondDir,
      },
    ]);
    assert.deepEqual(jobs, [
      { id: "job-1", name: "First job", agentId: "athena" },
      { id: "job-2", name: "Second job", agentId: "elon" },
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
