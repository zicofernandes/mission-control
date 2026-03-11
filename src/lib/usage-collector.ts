/**
 * Usage Collector - Reads gateway session data and calculates costs
 */

import { calculateCost, normalizeModelId } from "./pricing.ts";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface SessionData {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  updatedAt: number;
  percentUsed: number;
}

export interface UsageSnapshot {
  timestamp: number;
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

export interface GatewaySession {
  agent: string;
  key: string;
  sessionId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  updatedAt?: number;
  percentUsed?: number;
}

const GATEWAY_SOURCES = [
  { agent: "athena", port: 18789 },
  { agent: "elon", port: 19001 },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getGatewaySessions(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.sessions)) {
    return payload.sessions.filter(isRecord);
  }

  return [];
}

export async function queryGatewayUsage(
  fetchImpl: typeof fetch = fetch,
): Promise<GatewaySession[]> {
  const results = await Promise.all(
    GATEWAY_SOURCES.map(async ({ agent, port }) => {
      try {
        const response = await fetchImpl(`http://localhost:${port}/api/sessions`, {
          signal: AbortSignal.timeout(2000),
        });

        if (!response.ok) {
          console.warn("Gateway returned non-OK status:", response.status, port);
          return [];
        }

        const payload = (await response.json()) as unknown;
        return getGatewaySessions(payload).map((session) => ({
          agent,
          key: typeof session.key === "string" ? session.key : "",
          sessionId:
            typeof session.sessionId === "string" ? session.sessionId : undefined,
          model: typeof session.model === "string" ? session.model : undefined,
          inputTokens:
            typeof session.inputTokens === "number" ? session.inputTokens : 0,
          outputTokens:
            typeof session.outputTokens === "number" ? session.outputTokens : 0,
          totalTokens:
            typeof session.totalTokens === "number" ? session.totalTokens : 0,
          updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : 0,
          percentUsed:
            typeof session.percentUsed === "number" ? session.percentUsed : 0,
        }));
      } catch (error) {
        console.warn("Failed to fetch usage from gateway:", error);
        return [];
      }
    }),
  );

  return results.flat();
}

/**
 * Extract session data from merged gateway sessions
 */
export function extractSessionData(sessionsWithAgent: GatewaySession[]): SessionData[] {
  const sessions: SessionData[] = [];

  for (const session of sessionsWithAgent) {
    if (!session.key) {
      continue;
    }

    sessions.push({
      agentId: session.agent,
      sessionKey: session.key,
      sessionId: session.sessionId || session.key,
      model: normalizeModelId(session.model || "unknown"),
      inputTokens: session.inputTokens || 0,
      outputTokens: session.outputTokens || 0,
      totalTokens: session.totalTokens || 0,
      updatedAt: session.updatedAt || 0,
      percentUsed: session.percentUsed || 0,
    });
  }

  return sessions;
}

/**
 * Calculate cost snapshot from session data
 */
export function calculateSnapshot(
  sessions: SessionData[],
  timestamp: number
): UsageSnapshot[] {
  const snapshots: UsageSnapshot[] = [];
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const hour = date.getUTCHours();

  // Group by agent and model
  const grouped = new Map<string, SessionData[]>();

  for (const session of sessions) {
    const key = `${session.agentId}:${session.model}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(session);
  }

  // Calculate totals and costs
  for (const [key, group] of grouped.entries()) {
    const [agentId, model] = key.split(":");
    const inputTokens = group.reduce((sum, s) => sum + s.inputTokens, 0);
    const outputTokens = group.reduce((sum, s) => sum + s.outputTokens, 0);
    const totalTokens = group.reduce((sum, s) => sum + s.totalTokens, 0);
    const cost = calculateCost(model, inputTokens, outputTokens);

    snapshots.push({
      timestamp,
      date: dateStr,
      hour,
      agentId,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
    });
  }

  return snapshots;
}

/**
 * Initialize SQLite database for usage tracking
 */
export function initDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_snapshots (
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
    );

    CREATE INDEX IF NOT EXISTS idx_date ON usage_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_agent ON usage_snapshots(agent_id);
    CREATE INDEX IF NOT EXISTS idx_model ON usage_snapshots(model);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_snapshots(timestamp);
  `);

  return db;
}

/**
 * Save snapshot to database
 */
export function saveSnapshot(
  db: Database.Database,
  snapshot: UsageSnapshot
): void {
  const stmt = db.prepare(`
    INSERT INTO usage_snapshots 
      (timestamp, date, hour, agent_id, model, input_tokens, output_tokens, total_tokens, cost)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    snapshot.timestamp,
    snapshot.date,
    snapshot.hour,
    snapshot.agentId,
    snapshot.model,
    snapshot.inputTokens,
    snapshot.outputTokens,
    snapshot.totalTokens,
    snapshot.cost
  );
}

/**
 * Collect and save current usage data
 * This captures a point-in-time snapshot of current session totals
 */
export async function collectUsage(
  dbPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const db = initDatabase(dbPath);

  try {
    const sessions = extractSessionData(await queryGatewayUsage(fetchImpl));
    const timestamp = Date.now();
    const snapshots = calculateSnapshot(sessions, timestamp);

    // Delete any snapshots from the same hour (avoid duplicates)
    const hour = new Date(timestamp).getUTCHours();
    const date = new Date(timestamp).toISOString().split("T")[0];
    
    db.prepare(`
      DELETE FROM usage_snapshots 
      WHERE date = ? AND hour = ?
    `).run(date, hour);

    // Save new snapshots
    for (const snapshot of snapshots) {
      saveSnapshot(db, snapshot);
    }

    console.log(`Collected ${snapshots.length} usage snapshots for ${date} ${hour}:00 UTC`);
  } finally {
    db.close();
  }
}
