import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const dockPath = path.join(process.cwd(), 'src/components/TenacitOS/Dock.tsx');

test('dock includes Projects, Tasks, and Calendar shortcuts', async () => {
  const source = await fs.readFile(dockPath, 'utf8');

  const projectsIndex = source.indexOf('{ href: "/projects", label: "Projects"');
  const tasksIndex = source.indexOf('{ href: "/tasks", label: "Tasks"');
  const calendarIndex = source.indexOf('{ href: "/calendar", label: "Calendar"');
  const cronIndex = source.indexOf('{ href: "/cron", label: "Cron Jobs"');

  assert.notEqual(projectsIndex, -1);
  assert.notEqual(tasksIndex, -1);
  assert.notEqual(calendarIndex, -1);
  assert.ok(projectsIndex < tasksIndex);
  assert.ok(tasksIndex < calendarIndex);
  assert.ok(calendarIndex < cronIndex);
});
