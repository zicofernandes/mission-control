import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resetActivitiesDbForTests } from './activities-db';
import { handleActivitiesGet, handleActivitiesPost } from './activities-route';

function makeTempOpenclawDir(): { root: string; openclawDir: string; missionControlDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-activities-route-'));
  const openclawDir = path.join(root, 'openclaw-athena');
  const missionControlDir = path.join(openclawDir, 'workspace', 'mission-control');
  fs.mkdirSync(missionControlDir, { recursive: true });
  fs.writeFileSync(
    path.join(openclawDir, 'openclaw.json'),
    JSON.stringify({ agents: { list: [{ id: 'athena', default: true }] } }),
    'utf-8',
  );

  return { root, openclawDir, missionControlDir };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test('activities route supports POST, filtered GET, and CSV export', async () => {
  const { root, openclawDir, missionControlDir } = makeTempOpenclawDir();
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;
  const previousCwd = process.cwd();

  try {
    process.env.OPENCLAW_DIRS = openclawDir;
    process.chdir(missionControlDir);
    resetActivitiesDbForTests();

    const createdResponse = await handleActivitiesPost(
      new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          description: 'Agent shipped dashboard wiring',
          status: 'success',
          duration_ms: 250,
          tokens_used: 42,
        }),
      }),
    );

    assert.equal(createdResponse.status, 201);
    const created = await readJson(createdResponse);
    assert.equal(created.agent, 'athena');
    assert.equal(created.duration_ms, 250);

    await handleActivitiesPost(
      new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'command',
          description: 'Fallback activity',
          status: 'error',
          agent: 'elon',
        }),
      }),
    );

    const listResponse = await handleActivitiesGet(
      new Request('http://localhost/api/activities?agent=athena&limit=0&offset=-5'),
    );
    assert.equal(listResponse.status, 200);
    const listed = await readJson(listResponse);
    assert.equal(listed.total, 1);
    assert.equal(listed.limit, 1);
    assert.equal(listed.offset, 0);
    assert.equal((listed.activities as Array<Record<string, unknown>>)[0]?.description, 'Agent shipped dashboard wiring');

    const csvResponse = await handleActivitiesGet(
      new Request('http://localhost/api/activities?format=csv&type=message'),
    );
    assert.equal(csvResponse.headers.get('content-type'), 'text/csv');
    const csv = await csvResponse.text();
    assert.match(csv, /id,timestamp,type,description,status,duration_ms,tokens_used,agent/);
    assert.match(csv, /Agent shipped dashboard wiring/);
    assert.doesNotMatch(csv, /Fallback activity/);
  } finally {
    resetActivitiesDbForTests();
    process.chdir(previousCwd);
    if (previousOpenclawDirs === undefined) {
      delete process.env.OPENCLAW_DIRS;
    } else {
      process.env.OPENCLAW_DIRS = previousOpenclawDirs;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('activities route validates required fields and status values', async () => {
  const missingFields = await handleActivitiesPost(
    new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'message' }),
    }),
  );
  assert.equal(missingFields.status, 400);

  const invalidStatus = await handleActivitiesPost(
    new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        description: 'Bad status',
        status: 'done',
      }),
    }),
  );
  assert.equal(invalidStatus.status, 400);
});
