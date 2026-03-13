# PRD: Mission Control Task Manager
**Version:** 1.0  
**Date:** 2026-03-13  
**Author:** Elon  
**Status:** Approved — build tonight after MC stabilisation

---

## Vision

Mission Control becomes the single place where Zico creates projects, Athena manages them (assigns tasks to agents and people, tracks progress, removes blockers), and agents execute the work. Every active build has a project. Every project has a transparent task plan. Nothing lives only in someone's head or a scattered doc folder.

**Owner model:**
- **Zico** — creates projects, sets direction, removes blockers
- **Athena** — PM layer: breaks projects into tasks, assigns to agents/people, tracks status
- **Elon (+ future agents)** — execute assigned tasks
- **People** — collaborators assigned tasks where human judgment is needed

---

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Areas model | 4 personal areas: Health / Relationships / Career / Money | Business categories (Internal, Client, SaaS, Research) nest inside Career + Money |
| Database | SQLite via Prisma | Zero-ops, file-based, no external dependencies |
| Architecture | Integrated into Mission Control | Single app, agent-native, activity feed wiring |
| Agent assignment | Full assignment (not just created_by) | Agents are primary executors; must be assigned owner of a task |
| Timeline | Build tonight, after MC stabilisation pass | Current MC first |

---

## Scope

### In Scope

**Projects**
- CRUD: create, edit, archive, delete
- Each project belongs to one Area (Health / Relationships / Career / Money)
- Each project has a description, status (active / paused / complete / archived)
- Projects can have a linked agent as default assignee
- All current doc-folder projects get migrated as real projects

**Tasks**
- CRUD: create, edit, move, delete, archive
- Fields: title, description, status (column), priority (urgent/high/medium/low), due date, project, assignee (agent or person)
- Kanban board: drag-and-drop columns (Backlog → In Progress → Review → Done)
- Assignee can be: an agent (Athena, Elon, future agents) or a named person
- Multiple assignees supported (primary + supporting)

**Agent Assignment System**
- When Athena creates/updates a task, she sets the assignee via the API
- Assigned agents see their tasks via `/api/tasks?assignee=elon`
- Agent ID maps directly to OpenClaw agent IDs (`zfhq` = Athena, `elon` = Elon)

**Activity Feed**
- Every task create/move/complete fires an activity event
- Dashboard "Total Activities" / "Today" / "Successful" counters get wired to real data
- Activity log stores actor (agent ID or "zico") + action + timestamp

**Calendar View**
- Tasks with due dates appear on a monthly/weekly calendar
- Color-coded by priority

**Archive**
- Bulk "Archive Done" action per project or per board
- Archived tasks searchable but hidden from default views

**Data Migration**
- Import 5 existing tasks + 4 projects from `kanban-dashboard/backend/data.json`
- Map existing "Career" area → Career; create other areas as empty
- Existing tasks stay in Backlog

### Out of Scope (v1)
- Time tracking
- Comments/threads on tasks (v2)
- File attachments on tasks (v2)
- Public project sharing
- Gantt chart view

---

## Data Model (SQLite via Prisma)

```prisma
model Project {
  id          String   @id @default(cuid())
  title       String
  description String?
  area        Area
  status      ProjectStatus @default(ACTIVE)
  agentId     String?  // default assignee agent (openclaw agent ID)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tasks       Task[]
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  priority    Priority   @default(MEDIUM)
  status      TaskStatus @default(BACKLOG)
  dueDate     DateTime?
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id])
  assignees   TaskAssignee[]
  activities  Activity[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  archivedAt  DateTime?
  position    Int        @default(0)
}

model TaskAssignee {
  id       String @id @default(cuid())
  taskId   String
  task     Task   @relation(fields: [taskId], references: [id])
  agentId  String?  // openclaw agent ID (e.g. "elon", "zfhq")
  person   String?  // free-text name for human collaborators
  role     AssigneeRole @default(PRIMARY)
}

model Activity {
  id        String   @id @default(cuid())
  taskId    String?
  task      Task?    @relation(fields: [taskId], references: [id])
  projectId String?
  actor     String   // agent ID or "zico"
  source    String   // "ui" | "api" | "agent"
  verb      String   // "created" | "moved" | "assigned" | "completed" | "commented"
  text      String
  meta      Json?
  createdAt DateTime @default(now())
}

enum Area          { HEALTH RELATIONSHIPS CAREER MONEY }
enum ProjectStatus { ACTIVE PAUSED COMPLETE ARCHIVED }
enum TaskStatus    { BACKLOG IN_PROGRESS REVIEW DONE }
enum Priority      { URGENT HIGH MEDIUM LOW }
enum AssigneeRole  { PRIMARY SUPPORTING }
```

---

## API Routes

```
GET    /api/tasks                    # list (filter: ?project=, ?assignee=, ?status=, ?area=)
POST   /api/tasks                    # create
PUT    /api/tasks/:id                # update
POST   /api/tasks/:id/move           # move to column
POST   /api/tasks/:id/assign         # assign agent/person
DELETE /api/tasks/:id                # delete
POST   /api/tasks/archive-done       # bulk archive completed

GET    /api/projects                 # list (filter: ?area=, ?status=)
POST   /api/projects                 # create
PUT    /api/projects/:id             # update
DELETE /api/projects/:id             # archive

GET    /api/activities               # activity feed (filter: ?limit=, ?actor=, ?type=)
```

**Agent-friendly headers (same as old app):**
- `X-Actor: elon` — identifies the agent making the request
- `X-Source: api` — distinguishes API calls from UI actions

---

## Pages / Nav

Add to Mission Control dock:

```
📋  /tasks      Kanban board (default: all projects, filterable by project/area)
📁  /projects   Project list grouped by Area
📅  /calendar   Calendar view of tasks with due dates
```

---

## Build Phases

### Phase 1 — Data layer (1.5h)
- Install Prisma + SQLite: `npm install prisma @prisma/client`
- Write schema (above)
- `prisma migrate dev --name init`
- Seed script: imports from `kanban-dashboard/backend/data.json`
- API routes: `/api/tasks`, `/api/projects`, `/api/activities`

### Phase 2 — Kanban UI (2h)
- Install `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- `/tasks` page: column board, draggable cards, add task modal
- Task card: title, priority badge, due date, assignee avatar (agent emoji)
- Filter bar: by project, by area, by assignee

### Phase 3 — Projects page (1h)
- `/projects` page: grouped by Area
- Project card: name, task counts (backlog/in-progress/done), linked agent
- Create/edit project modal

### Phase 4 — Calendar (1.5h)
- Install `@fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`
- `/calendar` page: tasks as events, color by priority
- Click event → navigate to task

### Phase 5 — Agent API + Activity wiring (1.5h)
- `X-Actor` / `X-Source` header handling on all routes
- Wire dashboard activity counters to `/api/activities`
- Agent task query: `GET /api/tasks?assignee=elon`
- Test: Athena creates a task via API, appears on board

### Phase 6 — Data migration + cleanup (30min)
- Run seed script against live data
- Verify 5 tasks + 4 projects imported
- Retire `kanban-dashboard` Express backend

**Total: ~8–9h** (Codex build, single PRD pass)

---

## Migration Data

From `kanban-dashboard/backend/data.json`:

**Projects to import:**
| Title | Area |
|---|---|
| Logging & Cost Tracking | Career |
| LLM Circuit Breaker | Career |
| Framework Improvements | Career |
| Codex Workflow Improvements | Career |

**Tasks to import (all → Backlog):**
| Title | Priority |
|---|---|
| Implement Logging & Cost Tracking System | High |
| Implement LLM Circuit Breaker for Primary Agent | High |
| Memory Compaction Routine | Medium |
| Rename Agent ID: zfhq → athena | Low |
| Codex Stall Pattern: Prevention + Detection + Intervention | High |

---

## Athena's PM Role (Operational)

Once built, Athena's standard workflow:

1. **New build request received** → Create project in `/projects` (area: Career or Money)
2. **Break down into tasks** → Add tasks to Backlog with priority + due date
3. **Assign** → Set `assignee: elon` (or appropriate agent) on each task
4. **Track** → Move tasks through columns as agents report progress
5. **Escalate** → If task blocked >24h, notify Zico in #agent-team
6. **Close** → Archive Done tasks at sprint end

Athena uses the API directly (not the UI) — `X-Actor: zfhq`, `X-Source: api`.

---

## Success Criteria

- [ ] Kanban board loads with 2 agents' assigned tasks visible
- [ ] Athena can create a task via API and it appears on board
- [ ] Elon can query his assigned tasks via `GET /api/tasks?assignee=elon`
- [ ] Dashboard activity counters show real numbers
- [ ] All 5 existing tasks + 4 projects migrated correctly
- [ ] Old kanban-dashboard backend retired
