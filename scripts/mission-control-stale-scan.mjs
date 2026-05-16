#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const tasksPath = process.env.TASKS_DATA_PATH || path.join(root, 'data', 'tasks.json');
const now = Date.now();
const tasks = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
let changed = false;
const events = [];

function tmuxSessions() {
  try {
    return execFileSync('tmux', ['-S', `${process.env.HOME}/.tmux/sock`, 'list-sessions', '-F', '#S'], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const sessions = new Set(tmuxSessions());
for (const task of tasks) {
  if (task.archived || task.status !== 'in_progress') continue;
  const staleMinutes = Number(task.staleAfterMinutes || 30);
  const lastHeartbeat = task.lastHeartbeatAt ? Date.parse(task.lastHeartbeatAt) : Date.parse(task.updatedAt || task.createdAt || 0);
  const ageMinutes = Number.isFinite(lastHeartbeat) ? (now - lastHeartbeat) / 60000 : Infinity;
  const proofExists = task.proofPath ? fssync.existsSync(task.proofPath) : false;
  const sessionAlive = task.runnerSession ? sessions.has(task.runnerSession) : null;

  if (proofExists && task.lifecycleStatus !== 'succeeded') {
    task.status = 'done';
    task.lifecycleStatus = 'succeeded';
    task.lastProofAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    events.push({ id: task.id, action: 'closed_with_existing_proof', proofPath: task.proofPath });
    changed = true;
    continue;
  }

  if (ageMinutes >= staleMinutes || sessionAlive === false) {
    task.lifecycleStatus = 'stale';
    task.blockedReason = sessionAlive === false ? `runner session missing: ${task.runnerSession}` : `no heartbeat for ${Math.round(ageMinutes)} minutes`;
    task.updatedAt = new Date().toISOString();
    events.push({ id: task.id, action: 'marked_stale', reason: task.blockedReason, operatorAgent: task.operatorAgent || 'athena' });
    changed = true;
  }
}

if (changed) {
  await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2) + '\n');
}
console.log(JSON.stringify({ ok: true, changed, events }, null, 2));
