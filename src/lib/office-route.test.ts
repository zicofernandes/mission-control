import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getAgentStatusFromGateway } from "./office-gateway.ts";
import { listOfficeAgents } from "./office-route.ts";

test("getAgentStatusFromGateway queries every configured gateway port and merges sessions", async () => {
  const now = new Date("2026-03-11T12:00:00.000Z").getTime();
  const realNow = Date.now;
  const fetchCalls: Array<{ url: string; authorization: string | null }> = [];

  Date.now = () => now;

  try {
    const status = await getAgentStatusFromGateway(
      {
        OPENCLAW_DIRS: "/tmp/.openclaw-athena, /tmp/.openclaw-elon",
      },
      ((configPath: string) => {
        if (configPath === "/tmp/.openclaw-athena/openclaw.json") {
          return JSON.stringify({
            gateway: {
              port: 18789,
              auth: { token: "athena-token" },
            },
          });
        }

        if (configPath === "/tmp/.openclaw-elon/openclaw.json") {
          return JSON.stringify({
            gateway: {
              port: 19001,
              auth: { token: "elon-token" },
            },
          });
        }

        throw new Error(`Unexpected config path: ${configPath}`);
      }) as typeof import("fs").readFileSync,
      (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        fetchCalls.push({
          url,
          authorization: new Headers(init?.headers).get("Authorization"),
        });

        if (url === "http://localhost:18789/api/sessions") {
          return new Response(
            JSON.stringify([
              {
                agentId: "athena",
                sessionId: "session-athena",
                label: "Reviewing docs",
                lastActivity: "2026-03-11T11:58:00.000Z",
              },
              {
                agentId: "shared",
                sessionId: "session-shared-old",
                label: "Older session",
                lastActivity: "2026-03-11T11:40:00.000Z",
              },
            ]),
            {
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url === "http://localhost:19001/api/sessions") {
          return new Response(
            JSON.stringify([
              {
                agentId: "elon",
                sessionId: "session-elon",
                label: "Shipping code",
                lastActivity: "2026-03-11T11:59:00.000Z",
              },
              {
                agentId: "shared",
                sessionId: "session-shared-new",
                label: "Newest session",
                lastActivity: "2026-03-11T11:57:00.000Z",
              },
            ]),
            {
              headers: { "content-type": "application/json" },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }) as typeof fetch,
    );

    assert.deepEqual(fetchCalls, [
      {
        url: "http://localhost:18789/api/sessions",
        authorization: "Bearer athena-token",
      },
      {
        url: "http://localhost:19001/api/sessions",
        authorization: "Bearer elon-token",
      },
    ]);
    assert.deepEqual(status, {
      athena: {
        isActive: true,
        currentTask: "ACTIVE: Reviewing docs",
        lastSeen: new Date("2026-03-11T11:58:00.000Z").getTime(),
      },
      elon: {
        isActive: true,
        currentTask: "ACTIVE: Shipping code",
        lastSeen: new Date("2026-03-11T11:59:00.000Z").getTime(),
      },
      shared: {
        isActive: true,
        currentTask: "ACTIVE: Newest session",
        lastSeen: new Date("2026-03-11T11:57:00.000Z").getTime(),
      },
    });
  } finally {
    Date.now = realNow;
  }
});

function makeTempOpenclawDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-office-"));
}

function writeIdentity(
  workspacePath: string,
  {
    name,
    emoji,
    role,
  }: { name: string; emoji: string; role: string },
): void {
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(
    path.join(workspacePath, "IDENTITY.md"),
    `- **Name:** ${name}\n- **Emoji:** ${emoji} Agent\n- **Role:** ${role}\n`,
    "utf-8",
  );
}

function writeMemory(workspacePath: string, content: string, modifiedAt: Date): void {
  const memoryDir = path.join(workspacePath, "memory");
  const today = new Date().toISOString().split("T")[0];
  const memoryPath = path.join(memoryDir, `${today}.md`);

  fs.mkdirSync(memoryDir, { recursive: true });
  fs.writeFileSync(memoryPath, `${content}\n`, "utf-8");
  fs.utimesSync(memoryPath, modifiedAt, modifiedAt);
}

test("listOfficeAgents builds office agents from IDENTITY.md across OPENCLAW_DIRS", () => {
  const firstDir = makeTempOpenclawDir();
  const secondDir = makeTempOpenclawDir();
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;

  try {
    const mainWorkspace = path.join(firstDir, "workspace");
    const freelanceWorkspace = path.join(secondDir, "workspace-freelance");

    writeIdentity(mainWorkspace, {
      name: "Tenacitas",
      emoji: "🦞",
      role: "Boss",
    });
    writeIdentity(freelanceWorkspace, {
      name: "DevClaw",
      emoji: "👨‍💻",
      role: "Developer",
    });

    writeMemory(
      mainWorkspace,
      "- Reviewing launch checklist",
      new Date(Date.now() - 2 * 60 * 1000),
    );

    fs.mkdirSync(path.join(firstDir, "workspace-support"), { recursive: true });
    fs.writeFileSync(
      path.join(firstDir, "openclaw.json"),
      JSON.stringify({
        agents: {
          list: [
            {
              id: "main",
              workspace: mainWorkspace,
              ui: { color: "#ff6b35" },
            },
            {
              id: "support",
              name: "Support Agent",
              workspace: path.join(firstDir, "workspace-support"),
            },
          ],
        },
      }),
      "utf-8",
    );

    fs.writeFileSync(
      path.join(secondDir, "openclaw.json"),
      JSON.stringify({
        agents: {
          list: [
            {
              id: "freelance",
              workspace: freelanceWorkspace,
              ui: { color: "#8b5cf6" },
            },
          ],
        },
      }),
      "utf-8",
    );

    process.env.OPENCLAW_DIRS = `${firstDir}, ${secondDir}`;

    assert.deepEqual(listOfficeAgents(), [
      {
        id: "main",
        name: "Tenacitas",
        emoji: "🦞",
        color: "#ff6b35",
        role: "Boss",
        currentTask: "ACTIVE: Reviewing launch checklist",
        isActive: true,
      },
      {
        id: "support",
        name: "Support Agent",
        emoji: "🤖",
        color: "#666",
        role: "Agent",
        currentTask: "SLEEPING: zzZ...",
        isActive: false,
      },
      {
        id: "devclaw",
        name: "DevClaw",
        emoji: "👨‍💻",
        color: "#8b5cf6",
        role: "Developer",
        currentTask: "SLEEPING: zzZ...",
        isActive: false,
      },
    ]);
  } finally {
    if (previousOpenclawDirs === undefined) {
      delete process.env.OPENCLAW_DIRS;
    } else {
      process.env.OPENCLAW_DIRS = previousOpenclawDirs;
    }

    fs.rmSync(firstDir, { recursive: true, force: true });
    fs.rmSync(secondDir, { recursive: true, force: true });
  }
});
