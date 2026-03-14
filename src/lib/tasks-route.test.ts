import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  handleTasksDelete,
  handleTasksGet,
  handleTasksPatch,
  handleTasksPost,
  handleTasksPut,
} from './tasks-route';

function makeTempTasksPath(): { root: string; filePath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-tasks-route-'));
  return {
    root,
    filePath: path.join(root, 'tasks.json'),
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown> | Array<Record<string, unknown>>>;
}

test('tasks route supports CRUD, move, assign, and archive actions', async () => {
  const { root, filePath } = makeTempTasksPath();
  const previousTasksPath = process.env.TASKS_DATA_PATH;

  try {
    process.env.TASKS_DATA_PATH = filePath;

    const createResponse = await handleTasksPost(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ship API',
          description: 'Implement task endpoints',
          nextRun: '2026-03-15T10:00:00.000Z',
        }),
      }),
    );

    assert.equal(createResponse.status, 201);
    const created = await readJson(createResponse) as Record<string, unknown>;
    const taskId = created.id as string;
    assert.equal(created.name, 'Ship API');

    const listResponse = await handleTasksGet(new Request('http://localhost/api/tasks'));
    const listed = await readJson(listResponse) as Array<Record<string, unknown>>;
    assert.equal(listResponse.status, 200);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.nextRun, '2026-03-15T10:00:00.000Z');

    const updateResponse = await handleTasksPut(
      new Request('http://localhost/api/tasks', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          name: 'Ship task API',
          description: 'Implement and verify task endpoints',
        }),
      }),
    );
    const updated = await readJson(updateResponse) as Record<string, unknown>;
    assert.equal(updated.name, 'Ship task API');

    const moveResponse = await handleTasksPatch(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          action: 'move',
          status: 'in_progress',
          position: 0,
        }),
      }),
    );
    const moved = await readJson(moveResponse) as Record<string, unknown>;
    assert.equal(moved.status, 'in_progress');

    const assignResponse = await handleTasksPatch(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          action: 'assign',
          assignee: 'elon',
        }),
      }),
    );
    const assigned = await readJson(assignResponse) as Record<string, unknown>;
    assert.equal(assigned.assignee, 'elon');

    const archiveResponse = await handleTasksPatch(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          action: 'archive',
        }),
      }),
    );
    const archived = await readJson(archiveResponse) as Record<string, unknown>;
    assert.equal(archived.archived, true);

    const visibleResponse = await handleTasksGet(new Request('http://localhost/api/tasks'));
    const visibleTasks = await readJson(visibleResponse) as Array<Record<string, unknown>>;
    assert.equal(visibleTasks.length, 0);

    const allResponse = await handleTasksGet(
      new Request('http://localhost/api/tasks?includeArchived=true'),
    );
    const allTasks = await readJson(allResponse) as Array<Record<string, unknown>>;
    assert.equal(allTasks.length, 1);
    assert.equal(allTasks[0]?.archived, true);

    const deleteResponse = await handleTasksDelete(
      new Request(`http://localhost/api/tasks?id=${taskId}`, { method: 'DELETE' }),
    );
    const deleted = await readJson(deleteResponse) as Record<string, unknown>;
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleted.success, true);
  } finally {
    if (previousTasksPath === undefined) {
      delete process.env.TASKS_DATA_PATH;
    } else {
      process.env.TASKS_DATA_PATH = previousTasksPath;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tasks route validates missing ids and invalid actions', async () => {
  const missingIdResponse = await handleTasksPut(
    new Request('http://localhost/api/tasks', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing id' }),
    }),
  );
  assert.equal(missingIdResponse.status, 400);

  const invalidActionResponse = await handleTasksPatch(
    new Request('http://localhost/api/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'task-1', action: 'explode' }),
    }),
  );
  assert.equal(invalidActionResponse.status, 400);
});
