"use client";

import { useEffect, useMemo, useState } from "react";
import {
  startOfWeek,
  addDays,
  format,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Clock3, ListTodo, Loader2 } from "lucide-react";

import {
  buildCalendarWeek,
  listUpcomingEntries,
  listUnscheduledTasks,
  summarizeCalendar,
} from "@/lib/calendar-page";
import type { TaskRecord } from "@/lib/task-model";

const HOURS = Array.from({ length: 17 }, (_, index) => index + 6);

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function WeeklyCalendar() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/tasks", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load tasks");
        }

        const payload = await response.json();
        if (!cancelled) {
          setTasks(Array.isArray(payload) ? (payload as TaskRecord[]) : []);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTasks([]);
          setError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => buildCalendarWeek(tasks, currentWeekStart), [tasks, currentWeekStart]);
  const summary = useMemo(() => summarizeCalendar(tasks, currentWeekStart), [tasks, currentWeekStart]);
  const upcoming = useMemo(() => listUpcomingEntries(tasks, 6), [tasks]);
  const unscheduled = useMemo(() => listUnscheduledTasks(tasks), [tasks]);

  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              <Calendar className="h-4 w-4" />
              Weekly schedule
            </div>
            <h2
              className="mt-2 text-2xl font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-0.04em" }}
            >
              {format(currentWeekStart, "MMM d")} to {format(addDays(currentWeekStart, 6), "MMM d")}
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Active tasks with a `nextRun` appear on the grid. Unscheduled tasks stay visible below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="rounded-lg border p-2"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              This week
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              className="rounded-lg border p-2"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Scheduled", value: summary.scheduled, tone: "var(--info)", bg: "var(--info-soft)" },
            { label: "This Week", value: summary.thisWeek, tone: "var(--accent)", bg: "var(--accent-soft)" },
            { label: "Overdue", value: summary.overdue, tone: "var(--warning)", bg: "var(--warning-soft)" },
            { label: "Unscheduled", value: summary.unscheduled, tone: "var(--text-primary)", bg: "var(--surface-elevated)" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border px-4 py-3"
              style={{ backgroundColor: item.bg, borderColor: "var(--border)" }}
            >
              <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: item.tone }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div
          className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--negative-soft)", borderColor: "rgba(255, 69, 58, 0.25)", color: "var(--negative)" }}
        >
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="grid grid-cols-8 border-b" style={{ borderColor: "var(--border)" }}>
          <div
            className="p-3 text-right text-xs uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)", borderRight: "1px solid var(--border)" }}
          >
            Time
          </div>
          {days.map((day) => (
            <div
              key={day.key}
              className="p-3 text-center"
              style={{
                borderRight: "1px solid var(--border)",
                backgroundColor: isToday(day.date) ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                {format(day.date, "EEE")}
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: isToday(day.date) ? "var(--accent)" : "var(--text-primary)" }}>
                {format(day.date, "d")}
              </div>
            </div>
          ))}
        </div>

        <div className="max-h-[680px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading calendar…</span>
            </div>
          ) : (
            HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8" style={{ borderBottom: "1px solid var(--border)" }}>
                <div
                  className="p-3 text-right text-xs"
                  style={{ color: "var(--text-muted)", borderRight: "1px solid var(--border)" }}
                >
                  {format(new Date(2026, 0, 1, hour, 0), "ha").toLowerCase()}
                </div>
                {days.map((day) => {
                  const entries = day.entries.filter((entry) => entry.nextRunAt.getHours() === hour);

                  return (
                    <div
                      key={`${day.key}-${hour}`}
                      className="min-h-[76px] p-2"
                      style={{
                        borderRight: "1px solid var(--border)",
                        backgroundColor: isToday(day.date) ? "rgba(255, 59, 48, 0.03)" : "transparent",
                      }}
                    >
                      {entries.map((entry) => (
                        <article
                          key={entry.task.id}
                          className="rounded-lg border px-2.5 py-2 text-xs"
                          style={{
                            backgroundColor: "var(--surface-elevated)",
                            borderColor: "rgba(255, 59, 48, 0.2)",
                          }}
                        >
                          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {entry.task.name}
                          </div>
                          <div className="mt-1 flex items-center gap-1" style={{ color: "var(--accent)" }}>
                            <Clock3 className="h-3 w-3" />
                            <span>{formatTime(entry.nextRunAt)}</span>
                          </div>
                          {entry.task.schedule && (
                            <div className="mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                              {entry.task.schedule}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Upcoming runs
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No upcoming runs found.
              </p>
            ) : (
              upcoming.map((entry) => (
                <div
                  key={entry.task.id}
                  className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {entry.task.name}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(entry.nextRunAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
                    {entry.task.schedule ?? "Manual"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" style={{ color: "var(--warning)" }} />
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Needs scheduling
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {unscheduled.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Every active task has a `nextRun`.
              </p>
            ) : (
              unscheduled.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border px-4 py-3"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {task.name}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {task.description || "Add a schedule or next run time from the tasks board."}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
