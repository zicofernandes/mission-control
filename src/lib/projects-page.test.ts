import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_PROJECT_FORM, formatProjectTimestamp, summarizeProjects, toProjectPayload } from './projects-page';

test('toProjectPayload trims values and clears blank optional fields', () => {
  assert.deepEqual(
    toProjectPayload({
      name: ' Mission Control ',
      description: ' Dashboard for active repos ',
      repositoryUrl: ' https://github.com/example/mission-control ',
      productionUrl: '   ',
    }),
    {
      name: 'Mission Control',
      description: 'Dashboard for active repos',
      repositoryUrl: 'https://github.com/example/mission-control',
      productionUrl: null,
    },
  );

  assert.deepEqual(toProjectPayload(EMPTY_PROJECT_FORM), {
    name: '',
    description: '',
    repositoryUrl: null,
    productionUrl: null,
  });
});

test('summarizeProjects counts repository, live, and recently updated projects', () => {
  const summary = summarizeProjects(
    [
      {
        id: 'project-1',
        name: 'Alpha',
        description: '',
        repositoryUrl: 'https://github.com/example/alpha',
        productionUrl: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
      },
      {
        id: 'project-2',
        name: 'Beta',
        description: '',
        repositoryUrl: null,
        productionUrl: 'https://beta.example.com',
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-04T00:00:00.000Z',
      },
      {
        id: 'project-3',
        name: 'Gamma',
        description: '',
        repositoryUrl: 'https://github.com/example/gamma',
        productionUrl: 'https://gamma.example.com',
        createdAt: '2026-03-03T00:00:00.000Z',
        updatedAt: 'invalid-date',
      },
    ],
    new Date('2026-03-14T12:00:00.000Z'),
  );

  assert.deepEqual(summary, {
    total: 3,
    withRepository: 2,
    live: 2,
    recentlyUpdated: 1,
  });
});

test('formatProjectTimestamp returns a readable date or null for invalid input', () => {
  assert.equal(formatProjectTimestamp('2026-03-14T12:00:00.000Z'), 'Mar 14, 2026');
  assert.equal(formatProjectTimestamp('not-a-date'), null);
});
