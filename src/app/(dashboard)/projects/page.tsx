"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ExternalLink, FolderKanban, Globe, Github, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  EMPTY_PROJECT_FORM,
  formatProjectTimestamp,
  summarizeProjects,
  toProjectPayload,
  type ProjectFormState,
} from "@/lib/projects-page";
import type { ProjectRecord } from "@/lib/projects";

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
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    />
  );
}

function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
        minHeight: "112px",
        resize: "vertical",
      }}
    />
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const summary = useMemo(() => summarizeProjects(projects), [projects]);

  const resetForm = () => {
    setForm(EMPTY_PROJECT_FORM);
    setEditingProjectId(null);
  };

  const updateForm = <Key extends keyof ProjectFormState>(key: Key, value: ProjectFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: editingProjectId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editingProjectId ? { id: editingProjectId } : {}),
          ...toProjectPayload(form),
        }),
      });

      await readJson(response);
      resetForm();
      await fetchProjects();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (project: ProjectRecord) => {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      description: project.description,
      repositoryUrl: project.repositoryUrl ?? "",
      productionUrl: project.productionUrl ?? "",
    });
  };

  const handleDelete = async (projectId: string) => {
    setPendingProjectId(projectId);
    setError(null);

    try {
      await readJson(await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, { method: "DELETE" }));
      if (editingProjectId === projectId) {
        resetForm();
      }
      await fetchProjects();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete project");
    } finally {
      setPendingProjectId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-0.04em" }}
          >
            <FolderKanban className="mr-3 inline-block h-8 w-8" style={{ color: "var(--accent)" }} />
            Projects
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Track active repositories, environments, and delivery status from one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: summary.total },
            { label: "With Repo", value: summary.withRepository },
            { label: "Live", value: summary.live },
            { label: "Updated 7d", value: summary.recentlyUpdated },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border px-4 py-3"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </header>

      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--negative-soft)", borderColor: "rgba(255, 69, 58, 0.25)", color: "var(--negative)" }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {editingProjectId ? "Edit project" : "New project"}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Capture the basics needed to track delivery.
              </p>
            </div>
            {editingProjectId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm"
                style={{ color: "var(--accent)" }}
              >
                Cancel
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <FieldLabel>Name</FieldLabel>
              <FieldInput
                required
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Mission Control"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Description</FieldLabel>
              <FieldTextarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="Internal operations dashboard for agent workflows"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Repository URL</FieldLabel>
              <FieldInput
                type="url"
                value={form.repositoryUrl}
                onChange={(event) => updateForm("repositoryUrl", event.target.value)}
                placeholder="https://github.com/org/repo"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Production URL</FieldLabel>
              <FieldInput
                type="url"
                value={form.productionUrl}
                onChange={(event) => updateForm("productionUrl", event.target.value)}
                placeholder="https://app.example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold"
              style={{
                backgroundColor: isSubmitting ? "var(--surface-hover)" : "var(--accent)",
                color: "white",
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingProjectId ? "Save project" : "Add project"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Portfolio
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {projects.length} tracked project{projects.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects...
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <FolderKanban className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                No projects yet
              </h3>
              <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
                Add your first project to keep repository and production links visible inside Mission Control.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
              {projects.map((project) => {
                const isPending = pendingProjectId === project.id;
                const updatedAt = formatProjectTimestamp(project.updatedAt);
                const createdAt = formatProjectTimestamp(project.createdAt);

                return (
                  <article
                    key={project.id}
                    className="flex min-h-[240px] flex-col rounded-2xl border p-4"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                          {project.name}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {project.description || "No description provided."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(project)}
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          aria-label={`Edit ${project.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(project.id)}
                          disabled={isPending}
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border)", color: "var(--negative)" }}
                          aria-label={`Delete ${project.name}`}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm">
                      <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <Github className="h-4 w-4" style={{ color: project.repositoryUrl ? "var(--info)" : "var(--text-muted)" }} />
                        {project.repositoryUrl ? (
                          <a
                            href={project.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline decoration-transparent underline-offset-4 hover:decoration-current"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Repository
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span>No repository linked</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <Globe className="h-4 w-4" style={{ color: project.productionUrl ? "var(--positive)" : "var(--text-muted)" }} />
                        {project.productionUrl ? (
                          <a
                            href={project.productionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline decoration-transparent underline-offset-4 hover:decoration-current"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Production
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span>No production URL</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-6 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                      <div>Created {createdAt ?? "unknown"}</div>
                      <div className="mt-2">Updated {updatedAt ?? "unknown"}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
