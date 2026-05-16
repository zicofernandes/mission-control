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
  sourceSystem?: string | null;
  sourceRef?: string | null;
  ownerAgent?: string | null;
  operatorAgent?: string | null;
  ownerHuman?: string | null;
  priority?: string | null;
  runnerType?: string | null;
  runnerSession?: string | null;
  jobRunId?: string | null;
  lastHeartbeatAt?: string | null;
  lastProofAt?: string | null;
  proofPath?: string | null;
  logPath?: string | null;
  completionCriteria?: string | null;
  blockedReason?: string | null;
  lifecycleStatus?: string | null;
  staleAfterMinutes?: number | null;
  incidentPath?: string | null;
}
