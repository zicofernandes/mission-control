import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Prisma migration creates the mission-control SQLite tables and indexes", () => {
  const rootDir = path.resolve(process.cwd());
  const migrationPath = path.join(
    rootDir,
    "prisma",
    "migrations",
    "20260314040000_init",
    "migration.sql",
  );
  const lockPath = path.join(rootDir, "prisma", "migrations", "migration_lock.toml");
  const migration = fs.readFileSync(migrationPath, "utf-8");
  const lockFile = fs.readFileSync(lockPath, "utf-8");

  assert.match(lockFile, /provider = "sqlite"/);
  assert.match(migration, /CREATE TABLE "activities"/);
  assert.match(migration, /CREATE TABLE "usage_snapshots"/);
  assert.match(migration, /"duration_ms" INTEGER/);
  assert.match(migration, /"tokens_used" INTEGER/);
  assert.match(migration, /"agent_id" TEXT NOT NULL/);
  assert.match(migration, /CREATE INDEX "idx_activities_timestamp"/);
  assert.match(migration, /CREATE INDEX "idx_timestamp" ON "usage_snapshots"/);
});
