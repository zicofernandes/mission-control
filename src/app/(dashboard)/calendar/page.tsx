"use client";

import { WeeklyCalendar } from "@/components/WeeklyCalendar";

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-0.04em" }}
        >
          Calendar
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Weekly scheduling view for task runs and gaps that still need a date.
        </p>
      </header>

      <WeeklyCalendar />
    </div>
  );
}
