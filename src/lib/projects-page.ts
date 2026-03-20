import type { CreateProjectInput } from './projects';
import { PROJECT_CATEGORIES, PROJECT_STATUSES, type ProjectCategory, type ProjectStatus } from './projects-constants';
export type { ProjectCategory, ProjectStatus };
export { PROJECT_CATEGORIES, PROJECT_STATUSES };

// ProjectRecord type only (no fs import)
export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string | null;
  productionUrl: string | null;
  category: ProjectCategory | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  doneCount: number;
}

export interface ProjectFormState {
  name: string;
  description: string;
  repositoryUrl: string;
  productionUrl: string;
  category: ProjectCategory | '';
  status: ProjectStatus;
}

export interface ProjectsSummary {
  total: number;
  withRepository: number;
  live: number;
  recentlyUpdated: number;
  blocked: number;
}

export const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  description: '',
  repositoryUrl: '',
  productionUrl: '',
  category: '',
  status: 'active',
};

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  internal: 'Internal',
  client: 'Client',
  product: 'Product',
  content: 'Content',
  research: 'Research',
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  blocked: 'Blocked',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: '#4ade80',
  blocked: '#f47067',
  paused: '#fbbf24',
  completed: '#60a5fa',
  archived: '#6b7280',
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
    category: form.category || null,
    status: form.status,
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
      summary.blocked += project.status === 'blocked' ? 1 : 0;
      return summary;
    },
    { total: 0, withRepository: 0, live: 0, recentlyUpdated: 0, blocked: 0 },
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

