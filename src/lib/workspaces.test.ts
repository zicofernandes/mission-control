import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listWorkspaces, resolveWorkspacePath } from "./workspaces";

function makeTempOpenclawDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-workspaces-"));
}

function writeIdentity(workspacePath: string, name: string, emoji: string): void {
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(
    path.join(workspacePath, "IDENTITY.md"),
    `- **Name:** ${name}\n- **Emoji:** ${emoji} Agent\n`,
    "utf-8",
  );
}

test("listWorkspaces scans every directory from OPENCLAW_DIRS", () => {
  const firstDir = makeTempOpenclawDir();
  const secondDir = makeTempOpenclawDir();

  try {
    writeIdentity(path.join(firstDir, "workspace"), "Tenacitas", "🦞");
    writeIdentity(path.join(firstDir, "workspace-infra"), "Infra", "🛠️");
    writeIdentity(path.join(secondDir, "workspace"), "Second Main", "🚀");
    writeIdentity(path.join(secondDir, "workspace-social"), "Social", "📣");
    fs.mkdirSync(path.join(secondDir, "workspace_notes"), { recursive: true });

    const workspaces = listWorkspaces({
      OPENCLAW_DIRS: `${firstDir}, ${secondDir}`,
    });

    assert.equal(workspaces.length, 4);
    const mainWorkspaces = workspaces.filter((workspace) => path.basename(workspace.path) === "workspace");
    const agentWorkspaces = workspaces.filter((workspace) => path.basename(workspace.path) !== "workspace");

    assert.equal(mainWorkspaces.length, 2);
    assert.equal(agentWorkspaces.length, 2);
    assert.equal(new Set(workspaces.map((workspace) => workspace.id)).size, 4);
    assert.deepEqual(
      mainWorkspaces.map((workspace) => workspace.name),
      ["Tenacitas", "Second Main"],
    );
    assert.deepEqual(
      new Set(mainWorkspaces.map((workspace) => workspace.agentName)),
      new Set(["Tenacitas", "Second Main"]),
    );
    assert.deepEqual(
      new Set(mainWorkspaces.map((workspace) => workspace.emoji)),
      new Set(["🦞", "🚀"]),
    );
    assert.deepEqual(
      new Set(mainWorkspaces.map((workspace) => workspace.path)),
      new Set([path.join(firstDir, "workspace"), path.join(secondDir, "workspace")]),
    );
    assert.deepEqual(agentWorkspaces, [
      {
        id: `${firstDir}::workspace-infra`,
        name: "Infra",
        agentName: "Infra",
        emoji: "🛠️",
        path: path.join(firstDir, "workspace-infra"),
        kind: "workspace",
      },
      {
        id: `${secondDir}::workspace-social`,
        name: "Social",
        agentName: "Social",
        emoji: "📣",
        path: path.join(secondDir, "workspace-social"),
        kind: "workspace",
      },
    ]);
    assert.equal(
      resolveWorkspacePath(`${firstDir}::workspace-infra`, { OPENCLAW_DIRS: `${firstDir}, ${secondDir}` }),
      path.join(firstDir, "workspace-infra"),
    );
    assert.equal(
      resolveWorkspacePath(`${secondDir}::workspace`, { OPENCLAW_DIRS: `${firstDir}, ${secondDir}` }),
      path.join(secondDir, "workspace"),
    );
  } finally {
    fs.rmSync(firstDir, { recursive: true, force: true });
    fs.rmSync(secondDir, { recursive: true, force: true });
  }
});

test("listWorkspaces falls back to OPENCLAW_DIR when OPENCLAW_DIRS is unset", () => {
  const openclawDir = makeTempOpenclawDir();

  try {
    writeIdentity(path.join(openclawDir, "workspace"), "Tenacitas", "🦞");
    fs.mkdirSync(path.join(openclawDir, "workspace-research"), { recursive: true });

    const workspaces = listWorkspaces({
      OPENCLAW_DIR: openclawDir,
    });

    assert.deepEqual(
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        agentName: workspace.agentName,
        emoji: workspace.emoji,
      })),
      [
        {
          id: `${openclawDir}::workspace`,
          name: "Tenacitas",
          agentName: "Tenacitas",
          emoji: "🦞",
        },
        {
          id: `${openclawDir}::workspace-research`,
          name: "Research",
          agentName: undefined,
          emoji: "🤖",
        },
      ],
    );
    assert.equal(
      resolveWorkspacePath(`${openclawDir}::workspace-research`, { OPENCLAW_DIR: openclawDir }),
      path.join(openclawDir, "workspace-research"),
    );
    assert.equal(resolveWorkspacePath("workspace-research", { OPENCLAW_DIR: openclawDir }), path.join(openclawDir, "workspace-research"));
  } finally {
    fs.rmSync(openclawDir, { recursive: true, force: true });
  }
});
