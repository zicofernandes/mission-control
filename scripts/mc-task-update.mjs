#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const tasksPath = process.env.TASKS_DATA_PATH || path.join(process.cwd(), 'data', 'tasks.json');
const args = process.argv.slice(2);
const id = args.shift();
if (!id) {
  console.error('usage: mc-task-update.mjs <task-id> key=value ...');
  process.exit(2);
}

function parseValue(raw) {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

const updates = {};
for (const arg of args) {
  const index = arg.indexOf('=');
  if (index < 1) continue;
  updates[arg.slice(0, index)] = parseValue(arg.slice(index + 1));
}
updates.updatedAt = new Date().toISOString();

const tasks = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
const task = tasks.find((entry) => entry.id === id);
if (!task) {
  console.error(`Task not found: ${id}`);
  process.exit(1);
}
Object.assign(task, updates);
await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, id, updates }, null, 2));
