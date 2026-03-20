export const TASK_COLUMNS = ['todo', 'in_progress', 'done'] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

export interface TaskRecord {
  id: string;
  name: string;
  description: string;
  status: TaskColumn;
  position: number;
  assignee: string | null;
  projectId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  schedule: string | null;
  nextRun: string | null;
}
