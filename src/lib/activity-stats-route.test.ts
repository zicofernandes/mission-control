import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { logActivity, resetActivitiesDbForTests } from './activities-db';
import { handleActivityStatsGet } from './activity-stats-route';

function makeTempOpenclawDir(): { root: string; openclawDir: string; missionControlDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-control-activity-stats-'));
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

test('activity stats route returns dashboard data from the resolved activities database', async () => {
  const { root, openclawDir, missionControlDir } = makeTempOpenclawDir();
  const previousOpenclawDirs = process.env.OPENCLAW_DIRS;
  const previousCwd = process.cwd();

  try {
    process.env.OPENCLAW_DIRS = openclawDir;
    process.chdir(missionControlDir);
    resetActivitiesDbForTests();

    logActivity('message', 'Dashboard success', 'success', { agent: 'athena' });
    logActivity('command', 'Dashboard error', 'error', { agent: 'athena' });

    const response = await handleActivityStatsGet();
    assert.equal(response.status, 200);

    const payload = await response.json() as {
      total: number;
      today: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
      heatmap: Array<{ day: string; count: number }>;
      trend: Array<{ day: string; count: number; success: number; errors: number }>;
      hourly: Array<{ hour: string; count: number }>;
    };

    assert.equal(payload.total, 2);
    assert.equal(payload.today, 2);
    assert.equal(payload.byType.message, 1);
    assert.equal(payload.byType.command, 1);
    assert.equal(payload.byStatus.success, 1);
    assert.equal(payload.byStatus.error, 1);
    assert.equal(payload.heatmap.length, 1);
    assert.equal(payload.heatmap[0]?.count, 2);
    assert.equal(payload.trend[0]?.count, 2);
    assert.equal(payload.trend[0]?.success, 1);
    assert.equal(payload.trend[0]?.errors, 1);
    assert.equal(payload.hourly[0]?.count, 2);
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
