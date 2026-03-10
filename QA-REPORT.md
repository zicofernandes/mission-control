# Mission Control — QA Bug Report

**Generated:** 2026-03-10 01:15 AM  
**Tester:** QA Automation  
**Reviewed by:** Elon

---

## Summary

| Category | Count |
|----------|-------|
| Critical | 3 |
| High | 6 |
| Medium | 5 |
| Total | 14 |

---

## Critical Bugs

### BUG-C001: /api/agents returns 500 error
- **Test case:** TC-C003 (Agents page shows both agents)
- **Expected:** API returns list of agents
- **Actual:** 500 Internal Server Error
- **Root cause:** Code expects `agent.workspace` but OpenClaw stores workspace in `agents.defaults.workspace`
- **File:** `src/app/api/agents/route.ts:74`
- **Severity:** Critical — breaks Agents, Office, and Dashboard multi-agent section
- **Fix:** Read workspace from `agents.defaults.workspace` if not in agent entry

### BUG-C002: Only reads single OPENCLAW_DIR
- **Test case:** TC-C003, TC-H004
- **Expected:** Shows both Elon and Athena agents
- **Actual:** Only reads `~/.openclaw` (Athena), misses `~/.openclaw-elon` (Elon)
- **Severity:** Critical — multi-agent not supported
- **Fix:** Add OPENCLAW_DIRS support or scan for multiple openclaw directories

### BUG-C003: Office page 3D rendering fails
- **Test case:** TC-C004
- **Expected:** 3D office renders with agents
- **Actual:** Page fails to load, console errors from /api/agents
- **Severity:** Critical — cascading from BUG-C001

---

## High Priority Bugs

### BUG-H001: "TenacitOS" in header
- **Location:** Top header bar, all pages
- **Expected:** "Mission Control" or "Limitless Era"
- **Actual:** "TenacitOS"
- **File:** `src/components/Header.tsx` or layout
- **Fix:** Use env var NEXT_PUBLIC_APP_TITLE

### BUG-H002: "Carlos" in user profile
- **Location:** Top right user badge, all pages
- **Expected:** "Zico" or configurable
- **Actual:** "Carlos"
- **Fix:** Use env var NEXT_PUBLIC_OWNER_USERNAME

### BUG-H003: "Organigrama" still Spanish
- **Location:** Agents page tab button
- **Expected:** "Org Chart"
- **Actual:** "Organigrama"
- **File:** `src/app/(dashboard)/agents/page.tsx:112`
- **Note:** Was supposed to be fixed but didn't take

### BUG-H004: "Tenacitas agent activity" text
- **Location:** Dashboard subtitle
- **Expected:** "Limitless Era agent activity"
- **Actual:** "Overview of Tenacitas agent activity" (partially fixed)
- **File:** `src/app/(dashboard)/page.tsx`

### BUG-H005: Activities page empty
- **Test case:** TC-H001
- **Expected:** Activity feed populated
- **Actual:** Empty or shows stale "2 months ago" data
- **Fix:** Wire to OpenClaw activity API or session logs

### BUG-H006: Costs page empty/no data
- **Test case:** TC-H002
- **Expected:** Token usage and costs displayed
- **Actual:** Empty or no data
- **Fix:** Run usage collection script, populate usage-tracking.db

---

## Medium Priority Bugs

### BUG-M001: Disk stats error
- **Console:** "Failed to get disk stats: TypeError: Cannot read properties of undefined"
- **Location:** `/api/system/stats/route.ts:32`
- **Root cause:** macOS `df` output format differs from Linux
- **Fix:** Handle macOS df output format

### BUG-M002: SVC shows 0/4
- **Location:** Bottom status bar
- **Expected:** Shows 4/4 active services
- **Actual:** "SVC: 0/4"
- **Fix:** Service detection not triggering (curl health checks timing out?)

### BUG-M003: VPN shows inactive (expected)
- **Location:** Bottom status bar
- **Note:** Not a bug — Tailscale not installed. Consider hiding if not configured.

### BUG-M004: UFW shows inactive (expected)
- **Location:** Bottom status bar
- **Note:** Not a bug — macOS doesn't use UFW. Should hide on macOS.

### BUG-M005: Spanish text in Workflows page
- **Location:** /workflows
- **Text:** "Tenacitas carga el skill advisory-board/SKILL.md", "Comprueba si hay cambios"
- **Fix:** Translate to English

---

## Config Requirements

```env
# .env.local additions
NEXT_PUBLIC_APP_TITLE=Mission Control
NEXT_PUBLIC_OWNER_USERNAME=Zico
NEXT_PUBLIC_OWNER_EMAIL=zico@limitlessera.com

# Multi-agent support (new)
OPENCLAW_DIRS=/Users/zico/.openclaw,/Users/zico/.openclaw-elon
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/agents/route.ts` | Fix workspace path, multi-dir support |
| `src/app/api/system/stats/route.ts` | Fix macOS df parsing |
| `src/app/api/system/monitor/route.ts` | Fix service detection |
| `src/app/(dashboard)/agents/page.tsx` | Fix "Organigrama" → "Org Chart" |
| `src/app/(dashboard)/page.tsx` | Fix Tenacitas reference |
| `src/app/(dashboard)/workflows/page.tsx` | Translate Spanish |
| `src/components/Header.tsx` or layout | Use env vars for branding |
| `.env.local` | Add missing env vars |
