import { TASK_COLUMNS, type TaskColumn, type TaskRecord } from './task-model';

export interface TaskBoard {
  columns: Record<TaskColumn, TaskRecord[]>;
  archived: TaskRecord[];
}

export interface TaskBoardSummary {
  active: number;
  archived: number;
  todo: number;
  inProgress: number;
  done: number;
}

function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function buildTaskBoard(tasks: TaskRecord[]): TaskBoard {
  const columns = {
    todo: [] as TaskRecord[],
    in_progress: [] as TaskRecord[],
    done: [] as TaskRecord[],
  } satisfies Record<TaskColumn, TaskRecord[]>;
  const archived: TaskRecord[] = [];

  for (const task of tasks) {
    if (task.archived) {
      archived.push(task);
      continue;
    }

    columns[task.status].push(task);
  }

  for (const column of TASK_COLUMNS) {
    columns[column] = sortTasks(columns[column]);
  }

  return {
    columns,
    archived: sortTasks(archived),
  };
}

export function summarizeTaskBoard(tasks: TaskRecord[]): TaskBoardSummary {
  const board = buildTaskBoard(tasks);

  return {
    active: board.columns.todo.length + board.columns.in_progress.length + board.columns.done.length,
    archived: board.archived.length,
    todo: board.columns.todo.length,
    inProgress: board.columns.in_progress.length,
    done: board.columns.done.length,
  };
}
