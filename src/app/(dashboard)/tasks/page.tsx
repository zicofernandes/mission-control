"use client";

import {
  useCallback,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Calendar,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { buildTaskBoard, summarizeTaskBoard } from "@/lib/task-board";
import { TASK_COLUMNS, type TaskColumn, type TaskRecord } from "@/lib/task-model";

const COLUMN_META: Record<TaskColumn, { title: string; accent: string; bg: string }> = {
  todo: { title: "To Do", accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  in_progress: { title: "In Progress", accent: "#60a5fa", bg: "rgba(96, 165, 250, 0.08)" },
  done: { title: "Done", accent: "#34d399", bg: "rgba(52, 211, 153, 0.08)" },
};

type TaskFormState = {
  name: string;
  description: string;
  assignee: string;
  projectId: string;
  schedule: string;
  nextRun: string;
  status: TaskColumn;
};

const EMPTY_FORM: TaskFormState = {
  name: "", description: "", assignee: "", projectId: "", schedule: "", nextRun: "", status: "todo",
};

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toApiDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : "Request failed";
    throw new Error(message);
  }
  return payload;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<{id:string,name:string}[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const query = includeArchived ? "?includeArchived=true" : "";
      const data = await readJson(await fetch(`/api/tasks${query}`, { cache: "no-store" }));
      setTasks(Array.isArray(data) ? (data as TaskRecord[]) : []);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => { void fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProjects(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))); })
      .catch(() => {});
  }, []);

  const board = useMemo(() => buildTaskBoard(tasks), [tasks]);
  const summary = useMemo(() => summarizeTaskBoard(tasks), [tasks]);

  const openNewTask = () => {
    setForm(EMPTY_FORM);
    setEditingTaskId(null);
    setModalOpen(true);
  };

  const openEditTask = (task: TaskRecord) => {
    setEditingTaskId(task.id);
    setForm({
      name: task.name,
      description: task.description,
      assignee: task.assignee ?? "",
      projectId: task.projectId ?? "",
      schedule: task.schedule ?? "",
      nextRun: toDatetimeLocalValue(task.nextRun),
      status: task.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setEditingTaskId(null);
    setError(null);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...(editingTaskId ? { id: editingTaskId } : {}),
        name: form.name.trim(),
        description: form.description.trim(),
        assignee: form.assignee.trim() || null,
        projectId: form.projectId || null,
        schedule: form.schedule.trim() || null,
        nextRun: toApiDate(form.nextRun),
        status: form.status,
      };
      const response = await fetch("/api/tasks", {
        method: editingTaskId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readJson(response);
      closeModal();
      await fetchTasks(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runTaskAction = async (taskId: string, request: RequestInit, failureMessage: string, path = "/api/tasks") => {
    setPendingTaskId(taskId);
    setError(null);
    try {
      await readJson(await fetch(path, request));
      await fetchTasks(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : failureMessage);
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "var(--text-primary)", marginBottom: "4px" }}>
            Tasks
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Active work, scheduled items, and completed tasks.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
          <button
            type="button"
            onClick={openNewTask}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px", backgroundColor: "#ef4444", color: "white", fontWeight: 700, fontSize: "14px", boxShadow: "0 0 0 2px rgba(239,68,68,0.3)" }}
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Active", value: summary.active, color: "var(--text-primary)" },
          { label: "To Do", value: summary.todo, color: COLUMN_META.todo.accent },
          { label: "In Progress", value: summary.inProgress, color: COLUMN_META.in_progress.accent },
          { label: "Done", value: summary.done, color: COLUMN_META.done.accent },
          { label: "Archived", value: summary.archived, color: "var(--text-muted)" },
        ].map((stat) => (
          <div key={stat.label} style={{ padding: "16px", borderRadius: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: stat.color, fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, lineHeight: 1, marginBottom: "6px" }}>
              {stat.value}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Board ── */}
      {isLoading ? (
        <div style={{ minHeight: "240px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "16px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)", gap: "10px" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading tasks
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "start" }}>
            {TASK_COLUMNS.map((column) => (
              <section key={column} style={{ borderRadius: "16px", backgroundColor: COLUMN_META[column].bg, border: `1px solid ${COLUMN_META[column].accent}33`, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div>
                    <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700 }}>
                      {COLUMN_META[column].title}
                    </h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
                      {board.columns[column].length} tasks
                    </p>
                  </div>
                  <span style={{ minWidth: "28px", height: "28px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: COLUMN_META[column].accent, color: "#08111f", fontWeight: 700, fontSize: "12px" }}>
                    {board.columns[column].length}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "12px" }}>
                  {board.columns[column].length === 0 ? (
                    <div style={{ padding: "18px 14px", borderRadius: "12px", border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: "13px", backgroundColor: "rgba(15,23,42,0.28)" }}>
                      No tasks in this column.
                    </div>
                  ) : (
                    board.columns[column].map((task, index) => {
                      const isPending = pendingTaskId === task.id;
                      return (
                        <article key={task.id} style={{ padding: "14px", borderRadius: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", opacity: isPending ? 0.65 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                            <div>
                              <h3 style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "15px", marginBottom: task.description ? "6px" : 0 }}>
                                {task.name}
                              </h3>
                              {task.description ? (
                                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 }}>
                                  {task.description}
                                </p>
                              ) : null}
                            </div>
                            {task.status === "done" ? <CheckCircle2 className="w-4 h-4" style={{ color: COLUMN_META.done.accent, flexShrink: 0 }} /> : null}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                            {task.assignee ? <TaskBadge icon={<User className="w-3.5 h-3.5" />} label={task.assignee} /> : null}
                            {task.schedule ? <TaskBadge icon={<Calendar className="w-3.5 h-3.5" />} label={task.schedule} /> : null}
                            {task.nextRun ? <TaskBadge icon={<Calendar className="w-3.5 h-3.5" />} label={formatTimestamp(task.nextRun) ?? task.nextRun} /> : null}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            <ActionButton disabled={isPending || column === "todo"} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "move", status: TASK_COLUMNS[TASK_COLUMNS.indexOf(column) - 1] }) }, "Failed to move task")}>
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending || index === 0} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "move", status: column, position: index - 1 }) }, "Failed to reorder task")}>
                              <ArrowUp className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending || index === board.columns[column].length - 1} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "move", status: column, position: index + 1 }) }, "Failed to reorder task")}>
                              <ArrowDown className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending || column === "done"} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "move", status: TASK_COLUMNS[TASK_COLUMNS.indexOf(column) + 1] }) }, "Failed to move task")}>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending} onClick={() => openEditTask(task)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "archive", archived: true }) }, "Failed to archive task")}>
                              <Archive className="w-3.5 h-3.5" />
                            </ActionButton>
                            <ActionButton disabled={isPending} onClick={() => { if (!window.confirm(`Delete "${task.name}"?`)) return; void runTaskAction(task.id, { method: "DELETE" }, "Failed to delete task", `/api/tasks?id=${encodeURIComponent(task.id)}`); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </ActionButton>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>

          {includeArchived && board.archived.length > 0 ? (
            <section style={{ marginTop: "20px", padding: "18px", borderRadius: "16px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ marginBottom: "14px" }}>
                <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", fontSize: "18px", fontWeight: 700 }}>Archived</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>Hidden from the active board until restored.</p>
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                {board.archived.map((task) => {
                  const isPending = pendingTaskId === task.id;
                  return (
                    <article key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "14px", borderRadius: "12px", backgroundColor: "var(--background)", border: "1px solid var(--border)", opacity: isPending ? 0.65 : 1 }}>
                      <div>
                        <div style={{ color: "var(--text-primary)", fontWeight: 700, marginBottom: "4px" }}>{task.name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Archived {formatTimestamp(task.archivedAt) ?? "recently"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <ActionButton disabled={isPending} onClick={() => void runTaskAction(task.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, action: "archive", archived: false }) }, "Failed to restore task")}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </ActionButton>
                        <ActionButton disabled={isPending} onClick={() => { if (!window.confirm(`Delete "${task.name}"?`)) return; void runTaskAction(task.id, { method: "DELETE" }, "Failed to delete task", `/api/tasks?id=${encodeURIComponent(task.id)}`); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </ActionButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* ── Modal ── */}
      {modalOpen ? (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}
        >
          <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px", padding: "28px", position: "relative" }}>
            <button type="button" onClick={closeModal} style={{ position: "absolute", top: "16px", right: "16px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>

            <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
              {editingTaskId ? "Edit Task" : "New Task"}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
              {editingTaskId ? "Update task details." : "Add a task to the board."}
            </p>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: "grid", gap: "12px" }}>
                <input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Task name *" style={inputStyle} />
                <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Description" rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: "88px" }} />
                <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as TaskColumn }))} style={inputStyle}>
                  {TASK_COLUMNS.map((col) => (
                    <option key={col} value={col}>{COLUMN_META[col].title}</option>
                  ))}
                </select>
                <select value={form.projectId} onChange={(e) => setForm((c) => ({ ...c, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">— none —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input value={form.assignee} onChange={(e) => setForm((c) => ({ ...c, assignee: e.target.value }))} placeholder="Assignee" style={inputStyle} />
                <input value={form.schedule} onChange={(e) => setForm((c) => ({ ...c, schedule: e.target.value }))} placeholder="Schedule / cadence" style={inputStyle} />
                <input type="datetime-local" value={form.nextRun} onChange={(e) => setForm((c) => ({ ...c, nextRun: e.target.value }))} style={inputStyle} />
              </div>

              {error ? <p style={{ marginTop: "12px", color: "#fca5a5", fontSize: "13px" }}>{error}</p> : null}

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={closeModal} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600, fontSize: "14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "10px", backgroundColor: "#ef4444", color: "white", fontWeight: 700, fontSize: "14px", opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingTaskId ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "999px", padding: "5px 10px", backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "12px" }}>
      {icon}{label}
    </span>
  );
}

function ActionButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: "30px", height: "30px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-secondary)", opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "11px 12px",
  color: "var(--text-primary)",
  fontSize: "14px",
};
