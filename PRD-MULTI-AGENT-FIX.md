# PRD: Mission Control Multi-Agent Support

Fix all features to support multiple OpenClaw agent directories.

## Environment
- Athena: `~/.openclaw` (port 18789)
- Elon: `~/.openclaw-elon` (port 19001)
- Env var: `OPENCLAW_DIRS=/Users/zico/.openclaw,/Users/zico/.openclaw-elon`

## Tasks

- [x] Task 1: Fix `/api/files/workspaces/route.ts` — read OPENCLAW_DIRS env var (comma-separated), loop through each dir, scan for `workspace` and `workspace-*` folders in each. Return combined list with agent names from IDENTITY.md.

- [x] Task 2: In `/Users/zico/repos/mission-control/src/lib/skill-parser.ts` at lines 41-42, update DEFAULT_WORKSPACE_PATH. Replace the single directory path logic with a new function `getDefaultWorkspaceSkillPaths()` that reads from OPENCLAW_DIRS and returns an array of paths like `['/Users/zico/.openclaw/workspace-infra/skills', '/Users/zico/.openclaw-elon/workspace-infra/skills']`. Code:
```typescript
function getDefaultWorkspaceSkillPaths(): string[] {
  const dirsEnv = process.env.OPENCLAW_DIRS || process.env.OPENCLAW_DIR || '/root/.openclaw';
  const dirs = dirsEnv.split(',').map((d) => d.trim()).filter(Boolean);
  return dirs.map((dir) => path.join(dir, 'workspace-infra', 'skills'));
}
```

- [x] Task 3: Update the `buildAgentSkillMap()` function (around line 112) to loop through ALL OPENCLAW_DIRS instead of just one. Change `const openclawDir = process.env.OPENCLAW_DIR || '/root/.openclaw';` to read OPENCLAW_DIRS and loop through each dir with `for (const openclawDir of openclawDirs)`. This function should accumulate skills from all agent directories into the same map.

- [x] Task 4: Update the `scanAllSkills()` function (around line 175-195) to use `getDefaultWorkspaceSkillPaths()` instead of the single `DEFAULT_WORKSPACE_PATH`. Change line with `const workspacePath = config.workspaceSkillsPath || DEFAULT_WORKSPACE_PATH;` to `const workspacePaths = config.workspaceSkillsPath ? [config.workspaceSkillsPath] : getDefaultWorkspaceSkillPaths();`. Then update the location resolution logic to handle multiple workspace paths and try each one when location is 'workspace'.

- [x] Task 5: Fix `/Users/zico/repos/mission-control/src/app/api/cron/route.ts` to query all agents. For each OPENCLAW_DIR in OPENCLAW_DIRS, run `openclaw --profile <agent_id> cron list --json --all` and merge results with `agentId` field added to each record. Return combined cron job list.

- [x] Task 6: Fix `/Users/zico/repos/mission-control/src/app/api/office/route.ts`. Update the `getAgentStatusFromGateway()` function to query BOTH gateway ports (18789 for Athena, 19001 for Elon). Read the port from each agent's `openclaw.json` config under `gateway?.port` field, then query that port's gateway API and merge session data.

- [x] Task 7: Fix `/Users/zico/repos/mission-control/src/app/api/activities/route.ts` and `/Users/zico/repos/mission-control/src/app/api/activities/stream/route.ts`. Ensure activities.db can receive data from both agents. Add an `agent` field to each activity record to distinguish which agent originated it.

- [x] Task 8: Fix `/Users/zico/repos/mission-control/src/scripts/collect-usage.ts`. Update to read from both gateway ports (18789 and 19001) and merge usage data. Run both queries and aggregate results with `agent` field added. This script should be runnable via `npx tsx src/scripts/collect-usage.ts`.

- [x] Task 9: Update the Office 3D config logic in `/Users/zico/repos/mission-control/src/app/api/office/route.ts`. Replace hardcoded AGENT_CONFIG with dynamic config that reads each agent's IDENTITY.md file (name, emoji, role) and builds the config object dynamically for all agents in OPENCLAW_DIRS.

## Pattern to Follow

Use this OPENCLAW_DIRS pattern consistently:
```typescript
const dirsEnv = process.env.OPENCLAW_DIRS || process.env.OPENCLAW_DIR || "/root/.openclaw";
const openclawDirs = dirsEnv.split(",").map((d) => d.trim()).filter(Boolean);

for (const dir of openclawDirs) {
  // Read config, scan workspaces, etc.
}
```

## Testing Checklist (After ALL Tasks Complete)

1. Memory page loads and shows workspaces from both Athena and Elon ✅
2. Skills page shows skills from both agents ✅
3. Cron page shows jobs from both gateways ✅
4. Office page loads without error and shows both agents with their emoji/roles ✅
5. Activity feed works with agent field visible ✅
6. Costs page shows aggregated usage data from both agents ✅

## Do NOT Change
- UI design or component structure
- Database schemas (only add agent field)
- Authentication flow
- Existing test files
- Port configuration (18789 = Athena, 19001 = Elon)
