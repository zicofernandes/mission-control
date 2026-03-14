import { addDays, format, isBefore, startOfDay } from "date-fns";

import type { TaskRecord } from "./task-model";

export interface CalendarEntry {
  task: TaskRecord;
  nextRunAt: Date;
}

export interface CalendarSummary {
  scheduled: number;
  thisWeek: number;
  overdue: number;
  unscheduled: number;
}

export interface CalendarDay {
  date: Date;
  key: string;
  entries: CalendarEntry[];
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function getSchedulableEntries(tasks: TaskRecord[]): CalendarEntry[] {
  return tasks
    .filter((task) => !task.archived && task.nextRun)
    .map((task) => ({
      task,
      nextRunAt: new Date(task.nextRun as string),
    }))
    .filter((entry) => isValidDate(entry.nextRunAt))
    .sort((left, right) => {
      const timeDifference = left.nextRunAt.getTime() - right.nextRunAt.getTime();
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.task.name.localeCompare(right.task.name);
    });
}

export function buildCalendarWeek(tasks: TaskRecord[], weekStart: Date): CalendarDay[] {
  const weekStartAt = startOfDay(weekStart);
  const weekEndAt = addDays(weekStartAt, 7);
  const entries = getSchedulableEntries(tasks);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStartAt, index);
    const dayStart = date.getTime();
    const dayEnd = addDays(date, 1).getTime();

    return {
      date,
      key: format(date, "yyyy-MM-dd"),
      entries: entries.filter((entry) => {
        const runAt = entry.nextRunAt.getTime();
        return runAt >= dayStart && runAt < dayEnd && runAt < weekEndAt.getTime();
      }),
    };
  });
}

export function summarizeCalendar(tasks: TaskRecord[], weekStart: Date, now = new Date()): CalendarSummary {
  const weekStartAt = startOfDay(weekStart);
  const weekEndAt = addDays(weekStartAt, 7);
  const entries = getSchedulableEntries(tasks);
  const nowStart = startOfDay(now);

  return {
    scheduled: entries.length,
    thisWeek: entries.filter((entry) => entry.nextRunAt >= weekStartAt && entry.nextRunAt < weekEndAt).length,
    overdue: entries.filter((entry) => isBefore(entry.nextRunAt, nowStart)).length,
    unscheduled: tasks.filter((task) => !task.archived && !task.nextRun).length,
  };
}

export function listUpcomingEntries(tasks: TaskRecord[], limit = 5, now = new Date()): CalendarEntry[] {
  return getSchedulableEntries(tasks)
    .filter((entry) => entry.nextRunAt >= now)
    .slice(0, limit);
}

export function listUnscheduledTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks
    .filter((task) => !task.archived && !task.nextRun)
    .sort((left, right) => left.name.localeCompare(right.name));
}
