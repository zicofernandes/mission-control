"use client";

import {
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ExternalLink, FolderKanban, Globe, Github, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  EMPTY_PROJECT_FORM,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  formatProjectTimestamp,
  summarizeProjects,
  toProjectPayload,
  type ProjectFormState,
} from "@/lib/projects-page";
import type { ProjectRecord } from "@/lib/projects-page";

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : "Request failed";
    throw new Error(message);
  }
  return payload;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
      {children}
    </label>
  );
}

function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
    />
  );
}

function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)", minHeight: "96px", resize: "vertical" }}
    />
  );
}

const selectStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: "14px",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await readJson(await fetch("/api/projects", { cache: "no-store" }));
      setProjects(Array.isArray(data) ? (data as ProjectRecord[]) : []);
      setError(null);
    } catch (fetchError) {
      setProjects([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  const summary = useMemo(() => summarizeProjects(projects), [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, filterCategory, filterStatus]);

  const openNew = () => {
    setForm(EMPTY_PROJECT_FORM);
    setEditingProjectId(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (project: ProjectRecord) => {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      description: project.description,
      repositoryUrl: project.repositoryUrl ?? "",
      productionUrl: project.productionUrl ?? "",
      category: project.category ?? "",
      status: project.status ?? "active",
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY_PROJECT_FORM);
    setEditingProjectId(null);
    setError(null);
  };

  const updateForm = <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
    setForm((c) => ({ ...c, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: editingProjectId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(editingProjectId ? { id: editingProjectId } : {}), ...toProjectPayload(form) }),
      });
      await readJson(response);
      closeModal();
      await fetchProjects();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Delete this project?")) return;
    setPendingProjectId(projectId);
    try {
      await readJson(await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, { method: "DELETE" }));
      await fetchProjects();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete project");
    } finally {
      setPendingProjectId(null);
    }
  };

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "var(--text-primary)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
            <FolderKanban style={{ color: "var(--accent)", width: "28px", height: "28px" }} />
            Projects
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
            {(filterCategory !== "all" || filterStatus !== "all") ? " (filtered)" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", backgroundColor: "#ef4444", color: "white", fontWeight: 700, fontSize: "14px", boxShadow: "0 0 0 2px rgba(239,68,68,0.3)" }}
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          New Project
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total", value: summary.total, color: "var(--text-primary)" },
          { label: "Active", value: (statusCounts["active"] ?? 0), color: "#4ade80" },
          { label: "Blocked", value: (statusCounts["blocked"] ?? 0), color: "#f47067" },
          { label: "With Repo", value: summary.withRepository, color: "var(--text-secondary)" },
          { label: "Live", value: summary.live, color: "#60a5fa" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "16px", borderRadius: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: s.color, fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, lineHeight: 1, marginBottom: "6px" }}>{s.value}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.6px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* Category filters */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: "4px" }}>Category</span>
          {["all", ...PROJECT_CATEGORIES].map((cat) => {
            const label = cat === "all" ? "All" : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS];
            const count = categoryCounts[cat] ?? 0;
            const active = filterCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  backgroundColor: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "white" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {label} {count > 0 ? <span style={{ opacity: 0.75 }}>({count})</span> : null}
              </button>
            );
          })}
        </div>

        {/* Status filters */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: "4px" }}>Status</span>
          {["all", ...PROJECT_STATUSES].map((st) => {
            const label = st === "all" ? "All" : STATUS_LABELS[st as keyof typeof STATUS_LABELS];
            const count = statusCounts[st] ?? 0;
            const active = filterStatus === st;
            const color = st !== "all" ? STATUS_COLORS[st as keyof typeof STATUS_COLORS] : "var(--accent)";
            return (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? color : "var(--border)"}`,
                  backgroundColor: active ? color : "var(--surface)",
                  color: active ? "#08111f" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {label} {count > 0 ? <span style={{ opacity: 0.75 }}>({count})</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,69,58,0.25)", backgroundColor: "rgba(255,69,58,0.08)", color: "#f47067", fontSize: "13px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {/* ── Portfolio grid ── */}
      {isLoading ? (
        <div style={{ minHeight: "240px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "16px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)", gap: "10px" }}>
          <Loader2 style={{ width: "16px", height: "16px" }} className="animate-spin" /> Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={{ minHeight: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "16px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)", gap: "12px" }}>
          <FolderKanban style={{ width: "40px", height: "40px", opacity: 0.4 }} />
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
            {projects.length === 0 ? "No projects yet" : "No projects match filters"}
          </div>
          {projects.length === 0 && (
            <button type="button" onClick={openNew} style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#ef4444", color: "white", fontWeight: 600, fontSize: "13px" }}>
              Add first project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {filteredProjects.map((project) => {
            const isPending = pendingProjectId === project.id;
            return (
              <article
                key={project.id}
                style={{ display: "flex", flexDirection: "column", borderRadius: "16px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: "18px", opacity: isPending ? 0.6 : 1 }}
              >
                {/* Card header */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                      {project.category && (
                        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "4px", backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                          {CATEGORY_LABELS[project.category as keyof typeof CATEGORY_LABELS] ?? project.category}
                        </span>
                      )}
                      <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "4px", backgroundColor: `${STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}22`, color: STATUS_COLORS[project.status as keyof typeof STATUS_COLORS] ?? "var(--text-muted)" }}>
                        {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS] ?? project.status}
                      </span>
                    </div>
                    <h3 style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "16px" }}>
                      {project.name}
                    </h3>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button type="button" onClick={() => openEdit(project)} style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <Pencil style={{ width: "14px", height: "14px" }} />
                    </button>
                    <button type="button" onClick={() => void handleDelete(project.id)} disabled={isPending} style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid var(--border)", color: "#f47067", opacity: isPending ? 0.4 : 1 }}>
                      {isPending ? <Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" /> : <Trash2 style={{ width: "14px", height: "14px" }} />}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5, marginBottom: "14px", flex: 1 }}>
                  {project.description || "No description provided."}
                </p>

                {/* Links */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <Github style={{ width: "14px", height: "14px", color: project.repositoryUrl ? "var(--info)" : "var(--text-muted)", flexShrink: 0 }} />
                    {project.repositoryUrl ? (
                      <a href={project.repositoryUrl} target="_blank" rel="noreferrer" style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                        Repository <ExternalLink style={{ width: "12px", height: "12px" }} />
                      </a>
                    ) : <span style={{ color: "var(--text-muted)" }}>No repository</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <Globe style={{ width: "14px", height: "14px", color: project.productionUrl ? "#4ade80" : "var(--text-muted)", flexShrink: 0 }} />
                    {project.productionUrl ? (
                      <a href={project.productionUrl} target="_blank" rel="noreferrer" style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                        Production <ExternalLink style={{ width: "12px", height: "12px" }} />
                      </a>
                    ) : <span style={{ color: "var(--text-muted)" }}>Not live</span>}
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                  Updated {formatProjectTimestamp(project.updatedAt) ?? "—"}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}
        >
          <div style={{ width: "100%", maxWidth: "500px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px", padding: "28px", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
            <button type="button" onClick={closeModal} style={{ position: "absolute", top: "16px", right: "16px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <X style={{ width: "16px", height: "16px" }} />
            </button>

            <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
              {editingProjectId ? "Edit Project" : "New Project"}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
              {editingProjectId ? "Update project details." : "Add a project to the portfolio."}
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "grid", gap: "6px" }}>
                  <FieldLabel>Name *</FieldLabel>
                  <FieldInput required value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Mission Control" />
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  <FieldLabel>Description</FieldLabel>
                  <FieldTextarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="What does this project do?" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <FieldLabel>Category</FieldLabel>
                    <select value={form.category} onChange={(e) => updateForm("category", e.target.value as ProjectFormState["category"])} style={selectStyle}>
                      <option value="">— none —</option>
                      {PROJECT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <FieldLabel>Status</FieldLabel>
                    <select value={form.status} onChange={(e) => updateForm("status", e.target.value as ProjectFormState["status"])} style={selectStyle}>
                      {PROJECT_STATUSES.map((st) => (
                        <option key={st} value={st}>{STATUS_LABELS[st as keyof typeof STATUS_LABELS]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  <FieldLabel>Repository URL</FieldLabel>
                  <FieldInput type="url" value={form.repositoryUrl} onChange={(e) => updateForm("repositoryUrl", e.target.value)} placeholder="https://github.com/org/repo" />
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  <FieldLabel>Production URL</FieldLabel>
                  <FieldInput type="url" value={form.productionUrl} onChange={(e) => updateForm("productionUrl", e.target.value)} placeholder="https://app.example.com" />
                </div>
              </div>

              {error && <p style={{ marginTop: "12px", color: "#f47067", fontSize: "13px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={closeModal} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600, fontSize: "14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "10px", backgroundColor: "#ef4444", color: "white", fontWeight: 700, fontSize: "14px", opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? <Loader2 style={{ width: "16px", height: "16px" }} className="animate-spin" /> : <Plus style={{ width: "16px", height: "16px" }} />}
                  {editingProjectId ? "Save changes" : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
