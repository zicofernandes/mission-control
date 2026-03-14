import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface SeedActivity {
  id: string;
  timestamp: Date;
  type: string;
  description: string;
  status: string;
  durationMs: number | null;
  tokensUsed: number | null;
  agent: string | null;
  metadata: string | null;
}

export interface SeedUsageSnapshot {
  timestamp: number;
  date: string;
  hour: number;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface SeedSourcePaths {
  activitiesPath?: string;
  usageDbPath?: string;
}

export function getSeedDatabasePath(databaseUrl: string | undefined = process.env.DATABASE_URL): string {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must use a SQLite file: path");
  }

  return databaseUrl.slice("file:".length);
}

function getDefaultActivitiesPath(): string {
  return path.join(process.cwd(), "data", "activities.json");
}

function getDefaultUsageDbPath(): string {
  return path.join(process.cwd(), "data", "usage-tracking.db");
}

export function loadSeedActivities(activitiesPath: string = getDefaultActivitiesPath()): SeedActivity[] {
  if (!fs.existsSync(activitiesPath)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(activitiesPath, "utf-8")) as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const item = entry as Record<string, unknown>;
    const timestamp = typeof item.timestamp === "string" ? new Date(item.timestamp) : null;

    if (
      typeof item.id !== "string" ||
      !timestamp ||
      Number.isNaN(timestamp.getTime()) ||
      typeof item.type !== "string" ||
      typeof item.description !== "string"
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        timestamp,
        type: item.type,
        description: item.description,
        status: typeof item.status === "string" ? item.status : "success",
        durationMs: typeof item.duration_ms === "number" ? item.duration_ms : null,
        tokensUsed: typeof item.tokens_used === "number" ? item.tokens_used : null,
        agent: typeof item.agent === "string" ? item.agent : null,
        metadata: item.metadata === undefined || item.metadata === null ? null : JSON.stringify(item.metadata),
      },
    ];
  });
}

export function loadSeedUsageSnapshots(usageDbPath: string = getDefaultUsageDbPath()): SeedUsageSnapshot[] {
  if (!fs.existsSync(usageDbPath)) {
    return [];
  }

  const db = new Database(usageDbPath, { readonly: true });

  try {
    return db
      .prepare(
        `SELECT timestamp, date, hour, agent_id, model, input_tokens, output_tokens, total_tokens, cost
         FROM usage_snapshots
         ORDER BY timestamp ASC, id ASC`,
      )
      .all()
      .map((row) => {
        const snapshot = row as Record<string, unknown>;

        return {
          timestamp: snapshot.timestamp as number,
          date: snapshot.date as string,
          hour: snapshot.hour as number,
          agentId: snapshot.agent_id as string,
          model: snapshot.model as string,
          inputTokens: snapshot.input_tokens as number,
          outputTokens: snapshot.output_tokens as number,
          totalTokens: snapshot.total_tokens as number,
          cost: snapshot.cost as number,
        };
      });
  } finally {
    db.close();
  }
}

export function seedDatabase(
  dbPath: string = getSeedDatabasePath(),
  sourcePaths: SeedSourcePaths = {},
): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  const seedActivities = loadSeedActivities(sourcePaths.activitiesPath);
  const seedUsageSnapshots = loadSeedUsageSnapshots(sourcePaths.usageDbPath);

  try {
    const insertActivity = db.prepare(`
      INSERT INTO activities (
        id, timestamp, type, description, status, duration_ms, tokens_used, agent, metadata
      ) VALUES (
        @id, @timestamp, @type, @description, @status, @duration_ms, @tokens_used, @agent, @metadata
      )
    `);
    const insertUsageSnapshot = db.prepare(`
      INSERT INTO usage_snapshots (
        timestamp, date, hour, agent_id, model, input_tokens, output_tokens, total_tokens, cost
      ) VALUES (
        @timestamp, @date, @hour, @agent_id, @model, @input_tokens, @output_tokens, @total_tokens, @cost
      )
    `);

    db.transaction(() => {
      db.exec("DELETE FROM activities; DELETE FROM usage_snapshots;");

      for (const activity of seedActivities) {
        insertActivity.run({
          id: activity.id,
          timestamp: activity.timestamp.toISOString(),
          type: activity.type,
          description: activity.description,
          status: activity.status,
          duration_ms: activity.durationMs,
          tokens_used: activity.tokensUsed,
          agent: activity.agent,
          metadata: activity.metadata,
        });
      }

      for (const snapshot of seedUsageSnapshots) {
        insertUsageSnapshot.run({
          timestamp: snapshot.timestamp,
          date: snapshot.date,
          hour: snapshot.hour,
          agent_id: snapshot.agentId,
          model: snapshot.model,
          input_tokens: snapshot.inputTokens,
          output_tokens: snapshot.outputTokens,
          total_tokens: snapshot.totalTokens,
          cost: snapshot.cost,
        });
      }
    })();
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase();
}
