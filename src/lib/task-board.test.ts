import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTaskBoard, summarizeTaskBoard } from './task-board';
import type { TaskRecord } from './task-model';

const sampleTasks: TaskRecord[] = [
  {
    id: 'task-1',
    name: 'First',
    description: '',
    status: 'in_progress',
    position: 1,
    assignee: null,
    archived: false,
    createdAt: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z',
    archivedAt: null,
    schedule: null,
    nextRun: null,
  },
  {
    id: 'task-2',
    name: 'Second',
    description: '',
    status: 'todo',
    position: 0,
    assignee: 'athena',
    archived: false,
    createdAt: '2026-03-14T00:01:00.000Z',
    updatedAt: '2026-03-14T00:01:00.000Z',
    archivedAt: null,
    schedule: null,
    nextRun: null,
  },
  {
    id: 'task-3',
    name: 'Third',
    description: '',
    status: 'in_progress',
    position: 0,
    assignee: null,
    archived: false,
    createdAt: '2026-03-14T00:02:00.000Z',
    updatedAt: '2026-03-14T00:02:00.000Z',
    archivedAt: null,
    schedule: null,
    nextRun: null,
  },
  {
    id: 'task-4',
    name: 'Archived',
    description: '',
    status: 'done',
    position: 0,
    assignee: null,
    archived: true,
    createdAt: '2026-03-14T00:03:00.000Z',
    updatedAt: '2026-03-14T00:03:00.000Z',
    archivedAt: '2026-03-14T00:04:00.000Z',
    schedule: null,
    nextRun: null,
  },
];

test('buildTaskBoard groups active tasks by column and keeps archived tasks separate', () => {
  const board = buildTaskBoard(sampleTasks);

  assert.deepEqual(board.columns.todo.map((task) => task.id), ['task-2']);
  assert.deepEqual(board.columns.in_progress.map((task) => task.id), ['task-3', 'task-1']);
  assert.deepEqual(board.columns.done.map((task) => task.id), []);
  assert.deepEqual(board.archived.map((task) => task.id), ['task-4']);
});

test('summarizeTaskBoard returns active and archived counts', () => {
  const summary = summarizeTaskBoard(sampleTasks);

  assert.deepEqual(summary, {
    active: 3,
    archived: 1,
    todo: 1,
    inProgress: 2,
    done: 0,
  });
});
