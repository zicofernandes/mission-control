# Kanban & Project Management — Migration Analysis

**Date:** 2026-03-13
**Author:** Elon
**Source repo:** `~/Developer/zico-ai-automation-lab/kanban-dashboard/`
**Target:** Mission Control (`~/repos/mission-control/`)

---

## 1. What the Old App Has

### Core Capabilities

| Feature | Stack | Notes |
|---|---|---|
| **Kanban board** | React + `@dnd-kit` | Drag-and-drop columns + cards |
| **Projects** | CRUD, grouped by Area | 4 areas: Health, Relationships, Career, Money |
| **Tasks** | CRUD + move between columns | Priority (urgent/high/medium/low), due date, project link |
| **Archive** | "Archive Done" batch action | Moves completed tasks to `archived.tasks` |
| **Activity log** | Per-action journal entries | Actor (zico/agent) + source (ui/api) tracking |
| **Calendar view** | FullCalendar (dayGrid + timeGrid) | Tasks with due dates rendered as events |
| **Docs browser** | Index + file reader | Reads from local `docs/mission-control/` folder |
| **Journal** | Daily markdown files | Auto-creates daily doc, appends activity, writes summary |
| **Search** | Full-text across tasks + docs | Single `/api/search` endpoint |
| **Agent API** | REST with `X-Actor`/`X-Source` headers | Agents can create/move tasks via API |

### Data Model (from `data.json`)

```
{
  projects: [{ id, title, area, position, created_at, updated_at }],
  columns:  [{ id, title, position, tasks: [...] }],
  tasks:    [{ id, title, description, priority, due_date, project_id, created_at, updated_at }],
  activities: [{ id, type, verb, text, task_id, project_id, actor, source, created_at }],
  archived: { tasks: [...] }
}
```

### Current Data State (live in `data.json`)

**Projects (4):**
- Logging & Cost Tracking
- LLM Circuit Breaker (Primary Agent Reliability)
- Framework Improvements
- Codex Workflow Improvements

**Tasks (5, all in Backlog):**
- Implement Logging & Cost Tracking System — High, overdue (2026-03-05)
- Implement LLM Circuit Breaker for Primary Agent — High
- Memory Compaction Routine — Medium
- Rename Agent ID: zfhq → athena — Low
- Codex Stall Pattern: Prevention + Detection + Intervention — High

### Backend
- Express.js on port 3001
- File-based persistence (`data.json`)
- Journal module writes to daily markdown files
- No auth (open API)

---

## 2. What Mission Control Has Today

| Capability | Status |
|---|---|
| Agents page | ✅ Live |
| File browser (Workspaces / Vault / System) | ✅ Live |
| 3D Office | ✅ Live |
| Activity feed | ⚠️ Wired but shows 0 (not connected to real data) |
| Cron jobs view | ✅ Live |
| Sessions view | ✅ Live |
| Memory browser | ✅ Live |
| Skills view | ✅ Live |
| **Kanban / Tasks** | ❌ Missing |
| **Projects** | ❌ Missing |
| **Calendar view** | ❌ Missing |
| **Journal / daily log** | ❌ Missing |

---

## 3. Impact Analysis

### Effort per Feature

| Feature | Effort | Value | Notes |
|---|---|---|---|
| Kanban board (columns + cards + DnD) | **M** (3–4h) | 🔴 High | Core PM feature; `@dnd-kit` already battle-tested in old app |
| Projects CRUD | **S** (1h) | 🔴 High | Simple list + area grouping |
| Task detail (priority, due, project link) | **S** (1h) | 🔴 High | Already modelled in old app |
| Archive | **XS** (30min) | 🟡 Medium | One endpoint + UI button |
| Activity log (real data) | **S** (1h) | 🔴 High | Mission Control already has the UI — just needs real data wiring |
| Calendar view | **M** (2–3h) | 🟡 Medium | FullCalendar install + task events |
| Journal / daily markdown | **XS** (30min) | 🟡 Medium | Already exists in old backend, reuse logic |
| Agent API (create/move tasks) | **S** (1h) | 🔴 High | Core to agent-native workflow |
| Data migration (5 tasks, 4 projects) | **XS** (15min) | 🔴 High | Just seed the new DB on first run |

**Total estimated effort: ~10–12h** (1.5 days Codex)

### Risks

- **Schema migration**: Old app uses flat `data.json`. New Mission Control should use a proper DB (SQLite via Prisma — already in Next.js stack) rather than inheriting the file-based approach.
- **Port conflict**: Old backend runs on 3001. Mission Control runs on 3000. Migration eliminates the old backend entirely — no port management needed.
- **DnD library**: Old app uses `@dnd-kit`. Mission Control uses React + Tailwind. `@dnd-kit` installs cleanly into Next.js — no conflict.
- **Areas model**: Old app hardcodes 4 personal areas (Health, Relationships, Career, Money). For agent-native PM, these should be configurable or replaced with project types (Internal, Client, SaaS, Research).

---

## 4. Architecture Decision: Integrated vs Separate

### Option A — Integrated into Mission Control ✅ Recommended

Add `/tasks`, `/projects`, `/calendar` as new pages inside the existing Mission Control Next.js app.

**Pros:**
- Single app, single auth, single deploy
- Tasks can reference agents directly (assign to Athena/Elon)
- Activity feed in Mission Control gets real data from task events
- Cron jobs can create/update tasks automatically
- One git repo, one port

**Cons:**
- Increases scope of Mission Control codebase

### Option B — Separate app, managed by Mission Control

Keep as standalone React+Express app. Mission Control embeds it via iframe or links out.

**Pros:**
- Clean separation, old code mostly reusable as-is

**Cons:**
- Two apps to deploy and maintain
- Two ports, two auth systems
- No deep integration (agents can't reference tasks from MC context)
- Iframe embedding is fragile

**Verdict: Option A.** The value of integration (agents assigning tasks, crons creating tasks, activity feed wiring) outweighs the added scope. The old Express backend gets retired entirely.

---

## 5. High-Level Migration Approach

### Phase 1 — Data Layer (Day 1 morning)
- Add Prisma + SQLite to Mission Control (or extend existing DB if present)
- Schema: `Project`, `Task`, `Column`, `Activity`
- Migration script: seed from `data.json` → new DB on first run
- API routes: `/api/tasks`, `/api/projects`, `/api/columns` (mirror old Express endpoints)

### Phase 2 — Kanban UI (Day 1 afternoon)
- Install `@dnd-kit/core` + `@dnd-kit/sortable`
- New page: `/tasks` — Kanban board (columns + draggable cards)
- New page: `/projects` — Project list grouped by type/area
- Reuse Task card design from old app, reskinned to Mission Control dark theme

### Phase 3 — Calendar + Journal (Day 2 morning)
- New page: `/calendar` — FullCalendar with task due dates as events
- Journal: wire daily markdown writes to Mission Control's existing memory system (already writes to `memory/YYYY-MM-DD.md`)

### Phase 4 — Agent API + Activity Wiring (Day 2 afternoon)
- Expose task API to agents: create task, move task, comment on task
- Wire Mission Control activity feed to task events (fixes the "0 activities" dashboard bug)
- Add nav items: Tasks, Projects, Calendar

### Phase 5 — Data migration + cleanup
- Run seed script against live `data.json`
- Verify all 5 tasks + 4 projects imported correctly
- Retire old kanban-dashboard app

---

## 6. Nav Changes Required

Add 3 new items to the Mission Control dock:

```
📋 Tasks     → /tasks     (Kanban board)
📁 Projects  → /projects  (Project list)
📅 Calendar  → /calendar  (Task calendar)
```

---

## 7. Open Questions for Zico

1. **Areas model** — keep Health/Relationships/Career/Money or replace with agent-native categories (Internal, Client, SaaS, Research)?
2. **DB choice** — use SQLite (simple, file-based, zero-ops) or Supabase (already authenticated, shareable)?
3. **Timeline** — build now or queue after current Mission Control stabilisation?
4. **Agent task assignment** — should Elon/Athena be assignable to tasks, or just tracked as `created_by`?

---

## Decision Log

| Date | Decision | Notes |
|---|---|---|
| 2026-03-13 | Analyse old kanban-dashboard for MC integration | Zico request |
| 2026-03-13 | Recommend Option A (integrated) | Rationale: agent-native integration value |
