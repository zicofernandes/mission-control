import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  archiveTask,
  assignTask,
  createTask,
  deleteTask,
  listTasks,
  moveTask,
  updateTask,
} from './tasks';

function makeTempTasksPath(): { root: string; filePath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-tasks-'));
  return {
    root,
    filePath: path.join(root, 'tasks.json'),
  };
}

test('tasks store supports create, update, move, assign, archive, and delete', async () => {
  const { root, filePath } = makeTempTasksPath();
  const previousTasksPath = process.env.TASKS_DATA_PATH;
  let tick = 0;

  try {
    process.env.TASKS_DATA_PATH = filePath;

    const now = () => `2026-03-14T12:00:0${tick++}.000Z`;
    const first = await createTask(
      { name: 'Write API tests', description: 'Cover the route handlers' },
      { now, idFactory: () => 'task-1' },
    );
    const second = await createTask(
      { name: 'Review API payloads', status: 'todo' },
      { now, idFactory: () => 'task-2' },
    );

    assert.equal(first.position, 0);
    assert.equal(second.position, 1);

    const updated = await updateTask(
      'task-1',
      { name: 'Write route tests', description: 'Cover move and archive' },
      { now },
    );
    assert.equal(updated?.name, 'Write route tests');

    const moved = await moveTask('task-2', { status: 'in_progress', position: 0 }, { now });
    assert.equal(moved?.status, 'in_progress');
    assert.equal(moved?.position, 0);

    const assigned = await assignTask('task-2', 'athena', { now });
    assert.equal(assigned?.assignee, 'athena');

    const archived = await archiveTask('task-2', true, { now });
    assert.equal(archived?.archived, true);
    assert.equal(archived?.archivedAt, '2026-03-14T12:00:05.000Z');

    assert.equal((await listTasks()).length, 1);
    assert.equal((await listTasks({ includeArchived: true })).length, 2);

    const deleted = await deleteTask('task-1');
    assert.equal(deleted, true);

    const remaining = await listTasks({ includeArchived: true });
    assert.deepEqual(
      remaining.map((task) => ({
        id: task.id,
        archived: task.archived,
        assignee: task.assignee,
        status: task.status,
      })),
      [{ id: 'task-2', archived: true, assignee: 'athena', status: 'in_progress' }],
    );
  } finally {
    if (previousTasksPath === undefined) {
      delete process.env.TASKS_DATA_PATH;
    } else {
      process.env.TASKS_DATA_PATH = previousTasksPath;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tasks store normalizes legacy tasks.json records for existing UI consumers', async () => {
  const { root, filePath } = makeTempTasksPath();
  const previousTasksPath = process.env.TASKS_DATA_PATH;

  try {
    process.env.TASKS_DATA_PATH = filePath;
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        {
          id: 'legacy-task',
          name: 'Example Cron Job',
          description: 'Example periodic task',
          schedule: '0 */4 * * *',
          nextRun: '2026-03-15T08:00:00.000Z',
        },
      ]),
    );

    const [task] = await listTasks();
    assert.equal(task?.id, 'legacy-task');
    assert.equal(task?.status, 'todo');
    assert.equal(task?.archived, false);
    assert.equal(task?.schedule, '0 */4 * * *');
    assert.equal(task?.nextRun, '2026-03-15T08:00:00.000Z');
  } finally {
    if (previousTasksPath === undefined) {
      delete process.env.TASKS_DATA_PATH;
    } else {
      process.env.TASKS_DATA_PATH = previousTasksPath;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
