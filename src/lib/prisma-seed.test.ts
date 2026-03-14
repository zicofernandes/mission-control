import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import {
  seedDatabase,
} from "../../prisma/seed";

test("Prisma seed imports activities.json and usage-tracking.db into the Prisma SQLite database", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-prisma-seed-"));
  const dbPath = path.join(tempDir, "mission-control.db");
  const activitiesPath = path.join(tempDir, "activities.json");
  const usageDbPath = path.join(tempDir, "usage-tracking.db");
  const migrationPath = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260314040000_init",
    "migration.sql",
  );
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  const sqlite = new Database(dbPath);
  sqlite.exec(migrationSql);
  sqlite.close();

  fs.writeFileSync(
    activitiesPath,
    JSON.stringify([
      {
        id: "activity-1",
        timestamp: "2026-03-12T09:00:00.000Z",
        type: "task",
        description: "Imported from JSON",
        status: "success",
        duration_ms: 1820,
        tokens_used: 640,
        agent: "athena",
        metadata: { source: "json", tags: ["migration"] },
      },
      {
        id: "activity-2",
        timestamp: "2026-03-12T10:00:00.000Z",
        type: "command",
        description: "Imported without optional fields",
      },
    ]),
  );

  const usageDb = new Database(usageDbPath);
  usageDb.exec(`
    CREATE TABLE usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      cost REAL NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  usageDb
    .prepare(`
      INSERT INTO usage_snapshots
        (timestamp, date, hour, agent_id, model, input_tokens, output_tokens, total_tokens, cost)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      1773306000000,
      "2026-03-11",
      15,
      "athena",
      "anthropic/claude-sonnet-4-5",
      3000,
      1500,
      4500,
      0.0495,
    );
  usageDb.close();

  try {
    seedDatabase(dbPath, { activitiesPath, usageDbPath });

    const db = new Database(dbPath, { readonly: true });
    const activities = db
      .prepare("SELECT id, agent, status, metadata FROM activities ORDER BY timestamp ASC")
      .all() as Array<{ id: string; agent: string | null; status: string; metadata: string | null }>;
    const usageSnapshots = db
      .prepare(
        "SELECT agent_id, total_tokens, cost FROM usage_snapshots ORDER BY timestamp ASC",
      )
      .all() as Array<{ agent_id: string; total_tokens: number; cost: number }>;
    db.close();

    assert.equal(activities.length, 2);
    assert.deepEqual(activities, [
      {
        id: "activity-1",
        agent: "athena",
        status: "success",
        metadata: JSON.stringify({ source: "json", tags: ["migration"] }),
      },
      {
        id: "activity-2",
        agent: null,
        status: "success",
        metadata: null,
      },
    ]);

    assert.equal(usageSnapshots.length, 1);
    assert.deepEqual(usageSnapshots, [
      {
        agent_id: "athena",
        total_tokens: 4500,
        cost: 0.0495,
      },
    ]);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
