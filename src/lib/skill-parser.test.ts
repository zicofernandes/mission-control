import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentSkillMap, getDefaultWorkspaceSkillPaths, scanAllSkills } from "./skill-parser.ts";

test("getDefaultWorkspaceSkillPaths returns skill paths for every OPENCLAW_DIRS entry", () => {
  assert.deepEqual(
    getDefaultWorkspaceSkillPaths({
      OPENCLAW_DIRS: "/Users/zico/.openclaw, /Users/zico/.openclaw-elon",
    }),
    [
      "/Users/zico/.openclaw/workspace-infra/skills",
      "/Users/zico/.openclaw-elon/workspace-infra/skills",
    ],
  );
});

test("getDefaultWorkspaceSkillPaths falls back to OPENCLAW_DIR", () => {
  assert.deepEqual(
    getDefaultWorkspaceSkillPaths({
      OPENCLAW_DIR: "/Users/zico/.openclaw",
    }),
    ["/Users/zico/.openclaw/workspace-infra/skills"],
  );
});

test("getDefaultWorkspaceSkillPaths falls back to the default root path", () => {
  assert.deepEqual(getDefaultWorkspaceSkillPaths({}), ["/root/.openclaw/workspace-infra/skills"]);
});

test("buildAgentSkillMap merges skill ownership across all OPENCLAW_DIRS entries", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-skill-parser-"));
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;

  try {
    const firstDir = path.join(tempRoot, "openclaw-athena");
    const secondDir = path.join(tempRoot, "openclaw-elon");
    const sharedSkillName = "shared-skill";

    for (const [dir, agentId] of [
      [firstDir, "athena"],
      [secondDir, "elon"],
    ] as const) {
      fs.mkdirSync(path.join(dir, "workspace-infra", "skills", sharedSkillName), { recursive: true });
      fs.writeFileSync(path.join(dir, "workspace-infra", "skills", sharedSkillName, "SKILL.md"), "# Test\n");
      fs.writeFileSync(
        path.join(dir, "openclaw.json"),
        JSON.stringify({
          agents: {
            list: [
              {
                id: agentId,
                workspace: path.join(dir, "workspace-infra"),
              },
            ],
          },
        }),
      );
    }

    process.env.OPENCLAW_DIRS = `${firstDir}, ${secondDir}`;

    assert.deepEqual(buildAgentSkillMap().get(sharedSkillName), ["athena", "elon"]);
  } finally {
    if (previousOpenclawDirs === undefined) {
      delete process.env.OPENCLAW_DIRS;
    } else {
      process.env.OPENCLAW_DIRS = previousOpenclawDirs;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("scanAllSkills resolves workspace skills across all default workspace paths", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-scan-all-skills-"));
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;
  const configPath = path.join(process.cwd(), "data", "configured-skills.json");
  const originalConfig = fs.readFileSync(configPath, "utf-8");

  try {
    const firstDir = path.join(tempRoot, "openclaw-athena");
    const secondDir = path.join(tempRoot, "openclaw-elon");
    const skillName = "multi-path-skill";

    fs.mkdirSync(path.join(firstDir, "workspace-infra", "skills"), { recursive: true });
    fs.mkdirSync(path.join(secondDir, "workspace-infra", "skills", skillName), { recursive: true });
    fs.writeFileSync(path.join(secondDir, "workspace-infra", "skills", skillName, "SKILL.md"), "# Multi Path\n");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        skills: [{ name: skillName, location: "workspace" }],
      }),
    );

    process.env.OPENCLAW_DIRS = `${firstDir}, ${secondDir}`;

    const skills = scanAllSkills();
    assert.equal(skills.length, 1);
    assert.equal(skills[0]?.location, path.join(secondDir, "workspace-infra", "skills", skillName));
  } finally {
    fs.writeFileSync(configPath, originalConfig);
    if (previousOpenclawDirs === undefined) {
      delete process.env.OPENCLAW_DIRS;
    } else {
      process.env.OPENCLAW_DIRS = previousOpenclawDirs;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
