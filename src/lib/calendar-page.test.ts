import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarWeek,
  listUpcomingEntries,
  listUnscheduledTasks,
  summarizeCalendar,
} from "./calendar-page";
import type { TaskRecord } from "./task-model";

const sampleTasks: TaskRecord[] = [
  {
    id: "task-1",
    name: "Morning deploy",
    description: "",
    status: "todo",
    position: 0,
    assignee: null,
    archived: false,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    archivedAt: null,
    schedule: "0 14 * * 1",
    nextRun: "2026-03-16T14:00:00.000Z",
  },
  {
    id: "task-2",
    name: "Nightly backup",
    description: "",
    status: "in_progress",
    position: 1,
    assignee: "athena",
    archived: false,
    createdAt: "2026-03-01T11:00:00.000Z",
    updatedAt: "2026-03-01T11:00:00.000Z",
    archivedAt: null,
    schedule: "0 2 * * *",
    nextRun: "2026-03-18T02:30:00.000Z",
  },
  {
    id: "task-3",
    name: "Missing schedule",
    description: "",
    status: "done",
    position: 2,
    assignee: null,
    archived: false,
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
    archivedAt: null,
    schedule: null,
    nextRun: null,
  },
  {
    id: "task-4",
    name: "Archived task",
    description: "",
    status: "todo",
    position: 3,
    assignee: null,
    archived: true,
    createdAt: "2026-03-01T13:00:00.000Z",
    updatedAt: "2026-03-01T13:00:00.000Z",
    archivedAt: "2026-03-02T00:00:00.000Z",
    schedule: "0 12 * * *",
    nextRun: "2026-03-17T12:00:00.000Z",
  },
  {
    id: "task-5",
    name: "Invalid run",
    description: "",
    status: "todo",
    position: 4,
    assignee: null,
    archived: false,
    createdAt: "2026-03-01T14:00:00.000Z",
    updatedAt: "2026-03-01T14:00:00.000Z",
    archivedAt: null,
    schedule: "0 0 * * *",
    nextRun: "invalid-date",
  },
  {
    id: "task-6",
    name: "Later task",
    description: "",
    status: "todo",
    position: 5,
    assignee: null,
    archived: false,
    createdAt: "2026-03-01T15:00:00.000Z",
    updatedAt: "2026-03-01T15:00:00.000Z",
    archivedAt: null,
    schedule: "0 9 * * 6",
    nextRun: "2026-03-28T09:00:00.000Z",
  },
];

test("buildCalendarWeek groups valid scheduled entries into the requested week", () => {
  const week = buildCalendarWeek(sampleTasks, new Date(2026, 2, 16, 12));
  const visibleIds = week.flatMap((day) => day.entries.map((entry) => entry.task.id));

  assert.equal(week.length, 7);
  assert.deepEqual(visibleIds, ["task-1", "task-2"]);
});

test("summarizeCalendar counts scheduled, overdue, unscheduled, and current-week tasks", () => {
  const summary = summarizeCalendar(
    sampleTasks,
    new Date(2026, 2, 16, 12),
    new Date(2026, 2, 17, 12),
  );

  assert.deepEqual(summary, {
    scheduled: 3,
    thisWeek: 2,
    overdue: 1,
    unscheduled: 1,
  });
});

test("listUpcomingEntries and listUnscheduledTasks return active tasks in stable order", () => {
  const upcoming = listUpcomingEntries(sampleTasks, 2, new Date(2026, 2, 17, 12));
  const unscheduled = listUnscheduledTasks(sampleTasks);

  assert.deepEqual(upcoming.map((entry) => entry.task.id), ["task-2", "task-6"]);
  assert.deepEqual(unscheduled.map((task) => task.id), ["task-3"]);
});
