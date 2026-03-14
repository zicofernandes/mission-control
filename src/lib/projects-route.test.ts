import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  handleProjectsDelete,
  handleProjectsGet,
  handleProjectsPost,
  handleProjectsPut,
} from './projects-route';

function makeTempProjectsPath(): { root: string; filePath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-projects-route-'));
  return {
    root,
    filePath: path.join(root, 'projects.json'),
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown> | Array<Record<string, unknown>>>;
}

test('projects route supports CRUD operations', async () => {
  const { root, filePath } = makeTempProjectsPath();
  const previousProjectsPath = process.env.PROJECTS_DATA_PATH;

  try {
    process.env.PROJECTS_DATA_PATH = filePath;

    const createResponse = await handleProjectsPost(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Mission Control',
          description: 'Dashboard project',
          repositoryUrl: 'https://github.com/example/mission-control',
        }),
      }),
    );

    assert.equal(createResponse.status, 201);
    const created = await readJson(createResponse) as Record<string, unknown>;
    const projectId = created.id as string;
    assert.equal(created.name, 'Mission Control');
    assert.equal(created.productionUrl, null);

    const listResponse = await handleProjectsGet(new Request('http://localhost/api/projects'));
    const listed = await readJson(listResponse) as Array<Record<string, unknown>>;
    assert.equal(listResponse.status, 200);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.repositoryUrl, 'https://github.com/example/mission-control');

    const getResponse = await handleProjectsGet(
      new Request(`http://localhost/api/projects?id=${projectId}`),
    );
    const fetched = await readJson(getResponse) as Record<string, unknown>;
    assert.equal(getResponse.status, 200);
    assert.equal(fetched.id, projectId);

    const updateResponse = await handleProjectsPut(
      new Request('http://localhost/api/projects', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: projectId,
          name: 'Mission Control UI',
          productionUrl: 'https://mission-control.example.com',
        }),
      }),
    );
    const updated = await readJson(updateResponse) as Record<string, unknown>;
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.name, 'Mission Control UI');
    assert.equal(updated.productionUrl, 'https://mission-control.example.com');

    const deleteResponse = await handleProjectsDelete(
      new Request(`http://localhost/api/projects?id=${projectId}`, { method: 'DELETE' }),
    );
    const deleted = await readJson(deleteResponse) as Record<string, unknown>;
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleted.success, true);

    const emptyListResponse = await handleProjectsGet(new Request('http://localhost/api/projects'));
    const emptyList = await readJson(emptyListResponse) as Array<Record<string, unknown>>;
    assert.equal(emptyList.length, 0);
  } finally {
    if (previousProjectsPath === undefined) {
      delete process.env.PROJECTS_DATA_PATH;
    } else {
      process.env.PROJECTS_DATA_PATH = previousProjectsPath;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('projects route validates missing ids and required names', async () => {
  const createResponse = await handleProjectsPost(
    new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Missing name' }),
    }),
  );
  assert.equal(createResponse.status, 400);

  const updateResponse = await handleProjectsPut(
    new Request('http://localhost/api/projects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing id' }),
    }),
  );
  assert.equal(updateResponse.status, 400);

  const deleteResponse = await handleProjectsDelete(
    new Request('http://localhost/api/projects', { method: 'DELETE' }),
  );
  assert.equal(deleteResponse.status, 400);
});
