# Multi-Agent API — Status, Problem Context & Options

**Date:** 2026-03-13
**Author:** Elon
**Status:** Code complete ✅ | End-to-end test pending ⏳

---

## Background

Mission Control was upgraded on 2026-03-12 (commit `5f45ab9`) to support two agents — Athena (`~/.openclaw`, port 18789) and Elon (`~/.openclaw-elon`, port 19001). The multi-agent build changed 26 files (+1728/-541 lines) and covered:

- `OPENCLAW_DIRS` env var support across all API routes
- Agents API reading from both gateway configs
- Cron API aggregating jobs from both gateways
- Office API querying both agent ports
- Workspace resolution using per-dir config

The code was committed but never fully tested end-to-end because an API crisis (Anthropic rate-limited + OpenAI auth failure) hit immediately after the build completed, preventing both agents from running verification tests.

---

## What Was Tested

| Component | Status |
|---|---|
| `/api/agents` — reads both dirs | ✅ Verified (returns `zfhq` + `elon`) |
| `/api/files/roots` — both workspaces visible | ✅ Verified |
| Workspace name/emoji resolution | ✅ Fixed (IDENTITY.md parser) |
| Agent order (Athena first) | ✅ Fixed |
| Online status (TCP probe) | ✅ Fixed (2026-03-13) |
| 3D Office wired to real agents | ✅ Fixed (2026-03-13) |

---

## What Has NOT Been Tested

### 1. Cron API — Both Gateways

**Route:** `/api/cron`

**Expected:** Returns merged job list from both `http://localhost:18789` and `http://localhost:19001`

**Risk:** If one gateway returns an error, the route may silently drop that gateway's jobs or crash entirely. The merge logic hasn't been verified with two live gateways.

**Test needed:**
```bash
curl -b cookies.txt http://localhost:3000/api/cron | jq '.jobs | length'
# Expected: total jobs across both gateways (Athena has ~8, Elon has ~6)
```

### 2. Office API — Dual Gateway Queries

**Route:** `/api/office` (or equivalent)

**Expected:** Queries both gateway ports for agent activity/session data

**Risk:** Port mismatch or auth failure on either gateway causes empty/partial data

**Test needed:**
```bash
curl -b cookies.txt http://localhost:3000/api/office | jq '.'
```

### 3. Sessions API — Both Agents

**Route:** `/api/sessions`

**Expected:** Returns sessions from both gateways

**Risk:** Session IDs may collide between gateways if not namespaced

### 4. Activity Feed — Real Data

**Dashboard shows:** 0 for Total Activities, Today, Successful, Errors

**Root cause:** Activity feed API not yet wired to real task/session event data

---

## Problem Statement

The multi-agent integration cannot be declared production-ready until all four items above are verified. The risk is not a crash — the app runs fine — but **silent data gaps**: a user sees only Athena's cron jobs, or only Elon's sessions, without knowing the other agent's data is missing.

---

## Solution Options

### Option A — Manual test pass (low effort, ~1h)

Run the 4 test commands manually, verify outputs, fix any failures found. Document results.

**Pros:** Fast, targeted
**Cons:** One-time, no regression protection

### Option B — Automated integration test suite (~3h)

Add a test file `src/app/api/multi-agent.test.ts` that hits each API route and asserts both agents' data appears in the response.

**Pros:** Regression-safe, runs on CI
**Cons:** Requires both gateways to be running during test (flaky in CI)

### Option C — Health check dashboard widget

Add a "Multi-Agent Health" widget to the Mission Control dashboard that pings each route and shows pass/fail per gateway.

**Pros:** Ongoing visibility, zero maintenance
**Cons:** ~2h to build the widget

---

## Decision & Plan

**Recommended: Option A first, then Option C.**

1. **Today / next session:** Run manual test pass on all 4 routes. Fix any issues found.
2. **After Kanban integration (Phase 4):** Add the health widget to dashboard — the activity feed wiring work overlaps with that build anyway.

### Manual Test Checklist

```bash
# 1. Get auth cookie
curl -s -c /tmp/mc.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"limitless2026"}'

# 2. Cron — both gateways
curl -s -b /tmp/mc.txt http://localhost:3000/api/cron | jq '{
  total: (.jobs | length),
  byGateway: [.jobs[].gatewayId] | group_by(.) | map({gateway: .[0], count: length})
}'

# 3. Sessions — both agents
curl -s -b /tmp/mc.txt http://localhost:3000/api/sessions | jq '{
  total: (.sessions | length),
  agents: [.sessions[].agentId] | unique
}'

# 4. Activity feed
curl -s -b /tmp/mc.txt "http://localhost:3000/api/activity?limit=10" | jq '{
  total: .total,
  sample: [.activities[0:3][].type]
}'
```

---

## Related Commits

| Commit | Description |
|---|---|
| `5f45ab9` | feat: multi-agent support (the main build) |
| `69b3d07` | fix: workspace path correction |
| `4ce45b5` | fix: AgentState undefined guard |
| `d5935d4` | feat: real agent wiring + i18n |
| `cd55326` | fix: atomic AgentEntry state (Office3D) |
