import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Prisma schema models the SQLite tables used by mission-control", () => {
  const rootDir = path.resolve(process.cwd());
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    prisma?: { seed?: string };
  };
  const schema = fs.readFileSync(
    path.join(rootDir, "prisma", "schema.prisma"),
    "utf-8",
  );

  assert.equal(packageJson.dependencies?.["@prisma/client"], "^6.6.0");
  assert.equal(packageJson.devDependencies?.prisma, "^6.6.0");
  assert.equal(packageJson.scripts?.["prisma:migrate"], "prisma migrate deploy");
  assert.equal(packageJson.scripts?.["prisma:generate"], "prisma generate");
  assert.equal(packageJson.scripts?.["prisma:seed"], "prisma db seed");
  assert.equal(packageJson.scripts?.["prisma:validate"], "prisma validate");
  assert.equal(
    packageJson.prisma?.seed,
    "node --experimental-strip-types prisma/seed.ts",
  );

  assert.match(schema, /generator client/);
  assert.match(schema, /provider = "sqlite"/);
  assert.match(schema, /url\s+= env\("DATABASE_URL"\)/);
  assert.match(schema, /model Activity/);
  assert.match(schema, /@@map\("activities"\)/);
  assert.match(schema, /durationMs\s+Int\?\s+@map\("duration_ms"\)/);
  assert.match(schema, /tokensUsed\s+Int\?\s+@map\("tokens_used"\)/);
  assert.match(schema, /model UsageSnapshot/);
  assert.match(schema, /@@map\("usage_snapshots"\)/);
  assert.match(schema, /agentId\s+String\s+@map\("agent_id"\)/);
  assert.match(schema, /inputTokens\s+Int\s+@map\("input_tokens"\)/);
  assert.match(schema, /outputTokens\s+Int\s+@map\("output_tokens"\)/);
  assert.match(schema, /totalTokens\s+Int\s+@map\("total_tokens"\)/);
});
