# PRD: Mission Control Multi-Agent Bug Fixes

**Date:** 2026-03-11
**Author:** Elon
**Priority:** P1
**Scope:** 2 bugs, surgical fixes

---

## Bug 1: Workspace agentName shows "Tenacitas" instead of actual name

### Problem
Elon's workspace displays "Tenacitas" (Spanish default) instead of "Elon" because the IDENTITY.md parser expects bold markdown format but our IDENTITY.md uses plain format.

### File
`src/lib/workspaces.ts`

### Function
`getAgentInfo()` — lines 24-42

### Current Code (line 30-31)
```typescript
const nameMatch = content.match(/- \*\*Name:\*\* (.+)/);
const emojiMatch = content.match(/- \*\*Emoji:\*\* (.+)/);
```

### Fixed Code
```typescript
// Support both formats: "- **Name:** X" and "- Name: X"
const nameMatch = content.match(/- (?:\*\*)?Name:(?:\*\*)? (.+)/);
const emojiMatch = content.match(/- (?:\*\*)?Emoji:(?:\*\*)? (.+)/);
```

### Test Verification
```bash
curl -s -b /tmp/mc-cookies.txt http://localhost:3000/api/files/workspaces | jq '.workspaces[].agentName'
# Expected: "Elon", "Athena" (not "Tenacitas")
```

---

## Bug 2: getDefaultWorkspaceSkillPaths uses wrong directory

### Problem
Function hardcodes `workspace-infra/skills` but actual skills are in `workspace/skills`.

### File
`src/lib/skill-parser.ts`

### Function
`getDefaultWorkspaceSkillPaths()` — line 60

### Current Code (line 60)
```typescript
.map((dir) => path.join(dir, 'workspace-infra', 'skills'));
```

### Fixed Code
```typescript
.map((dir) => path.join(dir, 'workspace', 'skills'));
```

### Test Verification
```bash
curl -s -b /tmp/mc-cookies.txt http://localhost:3000/api/skills | jq '.skills | length'
# Expected: >0 (currently returns 0 without config workaround)
```

---

## Do NOT Change

- `src/app/api/files/workspaces/route.ts` — just calls listWorkspaces()
- `src/app/api/skills/route.ts` — just calls scanAllSkills()
- `data/configured-skills.json` — keep current workaround until code fix verified

---

## Verification Steps

1. Apply both fixes
2. Restart dev server: `npm run dev`
3. Run test commands above
4. Confirm Workspaces shows "Elon" not "Tenacitas"
5. Confirm Skills returns >0 without relying on full-path config workaround
