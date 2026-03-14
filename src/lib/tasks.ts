import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { TASK_COLUMNS, type TaskColumn, type TaskRecord } from './task-model';

export { TASK_COLUMNS };
export type { TaskColumn, TaskRecord };

export interface CreateTaskInput {
  name: string;
  description?: string;
  status?: TaskColumn;
  assignee?: string | null;
  schedule?: string | null;
  nextRun?: string | null;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: TaskColumn;
  assignee?: string | null;
  schedule?: string | null;
  nextRun?: string | null;
}

interface TaskStoreOptions {
  now?: () => string;
  idFactory?: () => string;
}

const DEFAULT_TASKS_PATH = path.join(process.cwd(), 'data', 'tasks.json');

function getTasksPath(): string {
  return process.env.TASKS_DATA_PATH || DEFAULT_TASKS_PATH;
}

function isTaskColumn(value: unknown): value is TaskColumn {
  return typeof value === 'string' && TASK_COLUMNS.includes(value as TaskColumn);
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
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createDefaultTaskRecord(raw: Record<string, unknown>, index: number): TaskRecord {
  const now = new Date(0).toISOString();
  const status = isTaskColumn(raw.status) ? raw.status : 'todo';
  const archived = raw.archived === true;

  return {
    id: normalizeString(raw.id) || `task-${index + 1}`,
    name: normalizeString(raw.name) || 'Untitled task',
    description: normalizeString(raw.description) || '',
    status,
    position: typeof raw.position === 'number' && Number.isFinite(raw.position) ? raw.position : index,
    assignee: normalizeNullableString(raw.assignee),
    archived,
    createdAt: normalizeIsoDate(raw.createdAt) || now,
    updatedAt: normalizeIsoDate(raw.updatedAt) || now,
    archivedAt: archived ? normalizeIsoDate(raw.archivedAt) || now : null,
    schedule: normalizeNullableString(raw.schedule),
    nextRun: normalizeIsoDate(raw.nextRun),
  };
}

function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    if (a.archived !== b.archived) {
      return Number(a.archived) - Number(b.archived);
    }

    if (a.status !== b.status) {
      return a.status.localeCompare(b.status);
    }

    if (a.position !== b.position) {
      return a.position - b.position;
    }

    return a.createdAt.localeCompare(b.createdAt);
  });
}

function resequenceTasks(tasks: TaskRecord[]): TaskRecord[] {
  const grouped = new Map<string, TaskRecord[]>();

  for (const task of sortTasks(tasks)) {
    const key = `${task.archived}:${task.status}`;
    const bucket = grouped.get(key) || [];
    bucket.push(task);
    grouped.set(key, bucket);
  }

  for (const bucket of grouped.values()) {
    bucket.forEach((task, index) => {
      task.position = index;
    });
  }

  return tasks;
}

async function loadTasks(): Promise<TaskRecord[]> {
  try {
    const content = await fs.readFile(getTasksPath(), 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return resequenceTasks(parsed.map((task, index) => createDefaultTaskRecord(task, index)));
  } catch {
    return [];
  }
}

async function saveTasks(tasks: TaskRecord[]): Promise<void> {
  const tasksPath = getTasksPath();
  await fs.mkdir(path.dirname(tasksPath), { recursive: true });
  await fs.writeFile(tasksPath, JSON.stringify(sortTasks(resequenceTasks(tasks)), null, 2) + '\n', 'utf-8');
}

function createStoreHelpers(options?: TaskStoreOptions) {
  return {
    now: options?.now || (() => new Date().toISOString()),
    idFactory: options?.idFactory || randomUUID,
  };
}

export async function listTasks(options?: { includeArchived?: boolean }): Promise<TaskRecord[]> {
  const tasks = await loadTasks();
  return options?.includeArchived ? tasks : tasks.filter((task) => !task.archived);
}

export async function createTask(input: CreateTaskInput, options?: TaskStoreOptions): Promise<TaskRecord> {
  const name = normalizeString(input.name);
  if (!name) {
    throw new Error('Task name is required');
  }

  const status = input.status && isTaskColumn(input.status) ? input.status : 'todo';
  const helpers = createStoreHelpers(options);
  const tasks = await loadTasks();
  const timestamp = helpers.now();
  const position = tasks.filter((task) => task.status === status && !task.archived).length;

  const task: TaskRecord = {
    id: helpers.idFactory(),
    name,
    description: normalizeString(input.description) || '',
    status,
    position,
    assignee: normalizeNullableString(input.assignee),
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    schedule: normalizeNullableString(input.schedule),
    nextRun: normalizeIsoDate(input.nextRun),
  };

  tasks.push(task);
  await saveTasks(tasks);
  return task;
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput,
  options?: TaskStoreOptions,
): Promise<TaskRecord | null> {
  const tasks = await loadTasks();
  const task = tasks.find((entry) => entry.id === id);

  if (!task) {
    return null;
  }

  const name = updates.name === undefined ? task.name : normalizeString(updates.name);
  if (!name) {
    throw new Error('Task name is required');
  }

  const helpers = createStoreHelpers(options);
  const nextStatus =
    updates.status === undefined
      ? task.status
      : isTaskColumn(updates.status)
        ? updates.status
        : null;

  if (!nextStatus) {
    throw new Error(`Invalid task status. Must be one of: ${TASK_COLUMNS.join(', ')}`);
  }

  if (nextStatus !== task.status) {
    task.status = nextStatus;
    task.position = tasks.filter(
      (entry) => entry.id !== task.id && entry.status === nextStatus && !entry.archived,
    ).length;
  }

  task.name = name;
  task.description =
    updates.description === undefined ? task.description : normalizeString(updates.description) || '';
  task.assignee =
    updates.assignee === undefined ? task.assignee : normalizeNullableString(updates.assignee);
  task.schedule =
    updates.schedule === undefined ? task.schedule : normalizeNullableString(updates.schedule);
  task.nextRun = updates.nextRun === undefined ? task.nextRun : normalizeIsoDate(updates.nextRun);
  task.updatedAt = helpers.now();

  await saveTasks(tasks);
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await loadTasks();
  const nextTasks = tasks.filter((task) => task.id !== id);

  if (nextTasks.length === tasks.length) {
    return false;
  }

  await saveTasks(nextTasks);
  return true;
}

export async function moveTask(
  id: string,
  input: { status?: TaskColumn; position?: number },
  options?: TaskStoreOptions,
): Promise<TaskRecord | null> {
  const tasks = await loadTasks();
  const task = tasks.find((entry) => entry.id === id);

  if (!task) {
    return null;
  }

  const nextStatus =
    input.status === undefined ? task.status : isTaskColumn(input.status) ? input.status : null;
  if (!nextStatus) {
    throw new Error(`Invalid task status. Must be one of: ${TASK_COLUMNS.join(', ')}`);
  }

  const targetColumnTasks = tasks
    .filter((entry) => entry.id !== id && entry.status === nextStatus && entry.archived === task.archived)
    .sort((a, b) => a.position - b.position);

  const rawPosition = typeof input.position === 'number' && Number.isFinite(input.position)
    ? Math.trunc(input.position)
    : targetColumnTasks.length;
  const nextPosition = Math.max(0, Math.min(rawPosition, targetColumnTasks.length));

  task.status = nextStatus;
  targetColumnTasks.splice(nextPosition, 0, task);
  targetColumnTasks.forEach((entry, index) => {
    entry.position = index;
  });

  const helpers = createStoreHelpers(options);
  task.updatedAt = helpers.now();

  await saveTasks(tasks);
  return task;
}

export async function assignTask(
  id: string,
  assignee: string | null,
  options?: TaskStoreOptions,
): Promise<TaskRecord | null> {
  const tasks = await loadTasks();
  const task = tasks.find((entry) => entry.id === id);

  if (!task) {
    return null;
  }

  const helpers = createStoreHelpers(options);
  task.assignee = normalizeNullableString(assignee);
  task.updatedAt = helpers.now();

  await saveTasks(tasks);
  return task;
}

export async function archiveTask(
  id: string,
  archived: boolean,
  options?: TaskStoreOptions,
): Promise<TaskRecord | null> {
  const tasks = await loadTasks();
  const task = tasks.find((entry) => entry.id === id);

  if (!task) {
    return null;
  }

  const helpers = createStoreHelpers(options);
  const timestamp = helpers.now();

  task.archived = archived;
  task.archivedAt = archived ? timestamp : null;
  task.updatedAt = timestamp;
  task.position = tasks.filter(
    (entry) => entry.id !== id && entry.archived === archived && entry.status === task.status,
  ).length;

  await saveTasks(tasks);
  return task;
}
