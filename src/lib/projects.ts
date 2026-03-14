import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string | null;
  productionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  repositoryUrl?: string | null;
  productionUrl?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repositoryUrl?: string | null;
  productionUrl?: string | null;
}

interface ProjectStoreOptions {
  now?: () => string;
  idFactory?: () => string;
}

const DEFAULT_PROJECTS_PATH = path.join(process.cwd(), 'data', 'projects.json');

function getProjectsPath(): string {
  return process.env.PROJECTS_DATA_PATH || DEFAULT_PROJECTS_PATH;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeString(value);
}

function normalizeIsoDate(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createDefaultProjectRecord(raw: Record<string, unknown>, index: number): ProjectRecord {
  const now = new Date(0).toISOString();

  return {
    id: normalizeString(raw.id) || `project-${index + 1}`,
    name: normalizeString(raw.name) || 'Untitled project',
    description: normalizeString(raw.description) || '',
    repositoryUrl: normalizeNullableString(raw.repositoryUrl),
    productionUrl: normalizeNullableString(raw.productionUrl),
    createdAt: normalizeIsoDate(raw.createdAt) || now,
    updatedAt: normalizeIsoDate(raw.updatedAt) || now,
  };
}

function sortProjects(projects: ProjectRecord[]): ProjectRecord[] {
  return [...projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

async function loadProjects(): Promise<ProjectRecord[]> {
  try {
    const content = await fs.readFile(getProjectsPath(), 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortProjects(parsed.map((project, index) => createDefaultProjectRecord(project, index)));
  } catch {
    return [];
  }
}

async function saveProjects(projects: ProjectRecord[]): Promise<void> {
  const projectsPath = getProjectsPath();
  await fs.mkdir(path.dirname(projectsPath), { recursive: true });
  await fs.writeFile(projectsPath, JSON.stringify(sortProjects(projects), null, 2) + '\n', 'utf-8');
}

function createStoreHelpers(options?: ProjectStoreOptions) {
  return {
    now: options?.now || (() => new Date().toISOString()),
    idFactory: options?.idFactory || randomUUID,
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return loadProjects();
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const projects = await loadProjects();
  return projects.find((project) => project.id === id) || null;
}

export async function createProject(
  input: CreateProjectInput,
  options?: ProjectStoreOptions,
): Promise<ProjectRecord> {
  const name = normalizeString(input.name);
  if (!name) {
    throw new Error('Project name is required');
  }

  const helpers = createStoreHelpers(options);
  const projects = await loadProjects();
  const timestamp = helpers.now();

  const project: ProjectRecord = {
    id: helpers.idFactory(),
    name,
    description: normalizeString(input.description) || '',
    repositoryUrl: normalizeNullableString(input.repositoryUrl),
    productionUrl: normalizeNullableString(input.productionUrl),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  projects.push(project);
  await saveProjects(projects);
  return project;
}

export async function updateProject(
  id: string,
  updates: UpdateProjectInput,
  options?: ProjectStoreOptions,
): Promise<ProjectRecord | null> {
  const projects = await loadProjects();
  const project = projects.find((entry) => entry.id === id);

  if (!project) {
    return null;
  }

  const name = updates.name === undefined ? project.name : normalizeString(updates.name);
  if (!name) {
    throw new Error('Project name is required');
  }

  const helpers = createStoreHelpers(options);

  project.name = name;
  project.description =
    updates.description === undefined ? project.description : normalizeString(updates.description) || '';
  project.repositoryUrl =
    updates.repositoryUrl === undefined
      ? project.repositoryUrl
      : normalizeNullableString(updates.repositoryUrl);
  project.productionUrl =
    updates.productionUrl === undefined
      ? project.productionUrl
      : normalizeNullableString(updates.productionUrl);
  project.updatedAt = helpers.now();

  await saveProjects(projects);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = await loadProjects();
  const nextProjects = projects.filter((project) => project.id !== id);

  if (nextProjects.length === projects.length) {
    return false;
  }

  await saveProjects(nextProjects);
  return true;
}
