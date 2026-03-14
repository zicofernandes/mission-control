import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';

import {
  getActivities,
  getActivitiesDbPath,
  logActivity,
  resetActivitiesDbForTests,
} from './activities-db';

test('activities-db uses the primary OPENCLAW_DIR database and migrates the agent column', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-activities-'));
  const firstDir = path.join(tempRoot, 'openclaw-athena');
  const secondDir = path.join(tempRoot, 'openclaw-elon');
  const firstMissionControl = path.join(firstDir, 'workspace', 'mission-control');
  const secondMissionControl = path.join(secondDir, 'workspace', 'mission-control');
  const dbPath = path.join(firstMissionControl, 'data', 'activities.db');
  const originalCwd = process.cwd();
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(secondMissionControl, { recursive: true });
  fs.writeFileSync(
    path.join(firstDir, 'openclaw.json'),
    JSON.stringify({ agents: { list: [{ id: 'athena', default: true }] } }),
  );
  fs.writeFileSync(
    path.join(secondDir, 'openclaw.json'),
    JSON.stringify({ agents: { list: [{ id: 'elon', default: true }] } }),
  );

  const seededDb = new Database(dbPath);
  seededDb.exec(`
    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      duration_ms INTEGER,
      tokens_used INTEGER
    )
  `);
  seededDb.close();

  try {
    process.env.OPENCLAW_DIRS = `${firstDir}, ${secondDir}`;
    process.chdir(secondMissionControl);
    resetActivitiesDbForTests();

    assert.equal(getActivitiesDbPath(), dbPath);

    const activity = logActivity('message', 'Merged activity from Elon', 'success', {
      agent: 'elon',
    });

    assert.equal(activity.agent, 'elon');

    const filtered = getActivities({ agent: 'elon', limit: 10 });
    assert.equal(filtered.total, 1);
    assert.equal(filtered.activities[0]?.agent, 'elon');
    assert.equal(filtered.activities[0]?.description, 'Merged activity from Elon');

    const db = new Database(dbPath, { readonly: true });
    const columns = db.prepare('PRAGMA table_info(activities)').all() as Array<{ name: string }>;
    const row = db.prepare('SELECT agent FROM activities WHERE id = ?').get(activity.id) as { agent: string };
    db.close();

    assert(columns.some((column) => column.name === 'agent'));
    assert.equal(row.agent, 'elon');
  } finally {
    resetActivitiesDbForTests();
    process.chdir(originalCwd);
    if (previousOpenclawDirs === undefined) {
      delete process.env.OPENCLAW_DIRS;
    } else {
      process.env.OPENCLAW_DIRS = previousOpenclawDirs;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
