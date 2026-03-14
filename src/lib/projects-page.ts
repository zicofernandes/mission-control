import type { CreateProjectInput, ProjectRecord } from './projects';

export interface ProjectFormState {
  name: string;
  description: string;
  repositoryUrl: string;
  productionUrl: string;
}

export interface ProjectsSummary {
  total: number;
  withRepository: number;
  live: number;
  recentlyUpdated: number;
}

export const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  description: '',
  repositoryUrl: '',
  productionUrl: '',
};

function normalizeNullableField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toProjectPayload(form: ProjectFormState): CreateProjectInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    repositoryUrl: normalizeNullableField(form.repositoryUrl),
    productionUrl: normalizeNullableField(form.productionUrl),
  };
}

export function summarizeProjects(
  projects: ProjectRecord[],
  now = new Date(),
): ProjectsSummary {
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000;

  return projects.reduce<ProjectsSummary>(
    (summary, project) => {
      const updatedAt = new Date(project.updatedAt);
      const isRecent =
        !Number.isNaN(updatedAt.getTime()) && now.getTime() - updatedAt.getTime() <= recentWindowMs;

      summary.total += 1;
      summary.withRepository += project.repositoryUrl ? 1 : 0;
      summary.live += project.productionUrl ? 1 : 0;
      summary.recentlyUpdated += isRecent ? 1 : 0;
      return summary;
    },
    { total: 0, withRepository: 0, live: 0, recentlyUpdated: 0 },
  );
}

export function formatProjectTimestamp(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
