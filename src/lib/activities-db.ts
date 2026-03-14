/**
 * SQLite-backed Activity Logger
 * Stores all agent activities with 30-day retention
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export type ActivityType =
  | 'file'
  | 'search'
  | 'message'
  | 'command'
  | 'security'
  | 'build'
  | 'task'
  | 'cron'
  | 'memory'
  | 'cron_run'
  | 'file_read'
  | 'file_write'
  | 'web_search'
  | 'message_sent'
  | 'tool_call'
  | 'agent_action';

export type ActivityStatus = 'success' | 'error' | 'pending' | 'running';

export interface Activity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
  agent: string | null;
  metadata: Record<string, unknown> | null;
}

let _db: Database.Database | null = null;
let _dbPath: string | null = null;

function getOpenclawDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || '';
  return dirsEnv.split(',').map((dir) => dir.trim()).filter(Boolean);
}

export function getActivitiesDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const [primaryOpenclawDir] = getOpenclawDirs(env);

  if (primaryOpenclawDir) {
    return path.join(primaryOpenclawDir, 'workspace', 'mission-control', 'data', 'activities.db');
  }

  return path.join(process.cwd(), 'data', 'activities.db');
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      duration_ms INTEGER,
      tokens_used INTEGER,
      agent TEXT,
      metadata TEXT
    );
  `);

  const columns = db.prepare('PRAGMA table_info(activities)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('agent')) {
    db.exec('ALTER TABLE activities ADD COLUMN agent TEXT');
  }

  if (!columnNames.has('metadata')) {
    db.exec('ALTER TABLE activities ADD COLUMN metadata TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
    CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
    CREATE INDEX IF NOT EXISTS idx_activities_agent ON activities(agent);
  `);
}

function getDefaultAgent(env: NodeJS.ProcessEnv = process.env): string | null {
  if (typeof env.ACTIVITY_AGENT === 'string' && env.ACTIVITY_AGENT.trim()) {
    return env.ACTIVITY_AGENT.trim();
  }

  const [openclawDir] = getOpenclawDirs(env);
  if (!openclawDir) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(path.join(openclawDir, 'openclaw.json'), 'utf-8')) as {
      agents?: { list?: Array<{ id?: string; default?: boolean }> };
    };
    const agents = config.agents?.list || [];
    return agents.find((agent) => agent.default)?.id || agents[0]?.id || null;
  } catch {
    return null;
  }
}

function getDb(): Database.Database {
  const dbPath = getActivitiesDbPath();
  if (_db && _dbPath === dbPath) return _db;
  if (_db && _dbPath !== dbPath) {
    _db.close();
    _db = null;
  }

  // Ensure data dir
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(dbPath);
  _dbPath = dbPath;

  // WAL mode for better concurrency
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');

  ensureSchema(_db);

  // Migrate from JSON if DB is empty and JSON exists
  const count = (_db.prepare('SELECT COUNT(*) as n FROM activities').get() as { n: number }).n;
  if (count === 0) {
    const jsonPath = path.join(path.dirname(dbPath), 'activities.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const insert = _db.prepare(`
          INSERT OR IGNORE INTO activities (id, timestamp, type, description, status, duration_ms, tokens_used, agent, metadata)
          VALUES (@id, @timestamp, @type, @description, @status, @duration_ms, @tokens_used, @agent, @metadata)
        `);
        const insertMany = _db.transaction((activities: Activity[]) => {
          for (const a of activities) {
            insert.run({
              ...a,
              agent: (a as Activity & { agent?: string }).agent ?? null,
              metadata: a.metadata ? JSON.stringify(a.metadata) : null,
            });
          }
        });
        insertMany(Array.isArray(data) ? data : []);
        console.log(`[activities-db] Migrated ${Array.isArray(data) ? data.length : 0} activities from JSON`);
      } catch (e) {
        console.warn('[activities-db] Migration from JSON failed:', e);
      }
    }
  }

  return _db;
}

export function logActivity(
  type: string,
  description: string,
  status: string,
  opts?: {
    duration_ms?: number | null;
    tokens_used?: number | null;
    agent?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Activity {
  const db = getDb();
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO activities (id, timestamp, type, description, status, duration_ms, tokens_used, agent, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    timestamp,
    type,
    description,
    status,
    opts?.duration_ms ?? null,
    opts?.tokens_used ?? null,
    opts?.agent ?? getDefaultAgent(),
    opts?.metadata ? JSON.stringify(opts.metadata) : null,
  );

  // Prune activities older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM activities WHERE timestamp < ?').run(cutoff);

  return {
    id,
    timestamp,
    type,
    description,
    status,
    duration_ms: opts?.duration_ms ?? null,
    tokens_used: opts?.tokens_used ?? null,
    agent: opts?.agent ?? getDefaultAgent(),
    metadata: opts?.metadata ?? null,
  };
}

export function updateActivity(
  id: string,
  status: string,
  opts?: { duration_ms?: number; tokens_used?: number }
): void {
  const db = getDb();
  db.prepare(`
    UPDATE activities SET status = ?, duration_ms = COALESCE(?, duration_ms), tokens_used = COALESCE(?, tokens_used)
    WHERE id = ?
  `).run(status, opts?.duration_ms ?? null, opts?.tokens_used ?? null, id);
}

export interface GetActivitiesOptions {
  type?: string;
  status?: string;
  agent?: string;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface ActivitiesResult {
  activities: Activity[];
  total: number;
}

function parseRow(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    type: row.type as string,
    description: row.description as string,
    status: row.status as string,
    duration_ms: row.duration_ms as number | null,
    tokens_used: row.tokens_used as number | null,
    agent: row.agent as string | null,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
  };
}

export function getActivities(opts: GetActivitiesOptions = {}): ActivitiesResult {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.type && opts.type !== 'all') {
    // Support comma-separated types
    const types = opts.type.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      // Also match legacy types (cron_run → cron, file_read/file_write → file, etc.)
      const aliases: Record<string, string[]> = {
        cron: ['cron', 'cron_run'],
        file: ['file', 'file_read', 'file_write'],
        search: ['search', 'web_search'],
        message: ['message', 'message_sent'],
        task: ['task', 'tool_call', 'agent_action'],
      };
      const expanded = aliases[types[0]] ?? [types[0]];
      conditions.push(`type IN (${expanded.map(() => '?').join(',')})`);
      params.push(...expanded);
    } else {
      conditions.push(`type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
  }

  if (opts.status && opts.status !== 'all') {
    conditions.push('status = ?');
    params.push(opts.status);
  }

  if (opts.agent) {
    conditions.push('agent = ?');
    params.push(opts.agent);
  }

  if (opts.startDate) {
    conditions.push('timestamp >= ?');
    params.push(opts.startDate);
  }

  if (opts.endDate) {
    // Include full end date
    conditions.push("timestamp <= datetime(?, '+1 day')");
    params.push(opts.endDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = opts.sort === 'oldest' ? 'ASC' : 'DESC';
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const total = (db.prepare(`SELECT COUNT(*) as n FROM activities ${where}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM activities ${where} ORDER BY timestamp ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];

  return {
    activities: rows.map(parseRow),
    total,
  };
}

export function getActivityStats(): {
  total: number;
  today: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
} {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const total = (db.prepare('SELECT COUNT(*) as n FROM activities').get() as { n: number }).n;
  const today = (db.prepare("SELECT COUNT(*) as n FROM activities WHERE timestamp >= ?").get(todayStart.toISOString()) as { n: number }).n;

  const typeRows = db.prepare("SELECT type, COUNT(*) as n FROM activities GROUP BY type").all() as Array<{ type: string; n: number }>;
  const byType: Record<string, number> = {};
  for (const r of typeRows) byType[r.type] = r.n;

  const statusRows = db.prepare("SELECT status, COUNT(*) as n FROM activities GROUP BY status").all() as Array<{ status: string; n: number }>;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  return { total, today, byType, byStatus };
}

export function getActivityTimelineStats(): {
  total: number;
  today: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  heatmap: Array<{ day: string; count: number }>;
  trend: Array<{ day: string; count: number; success: number; errors: number }>;
  hourly: Array<{ hour: string; count: number }>;
} {
  const db = getDb();
  const stats = getActivityStats();
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const heatmap = db.prepare(`
    SELECT DATE(timestamp) as day, COUNT(*) as count
    FROM activities
    WHERE timestamp >= ?
    GROUP BY DATE(timestamp)
    ORDER BY day
  `).all(cutoff) as Array<{ day: string; count: number }>;

  const trend = db.prepare(`
    SELECT DATE(timestamp) as day, COUNT(*) as count,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
    FROM activities
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY DATE(timestamp)
    ORDER BY day DESC
  `).all() as Array<{ day: string; count: number; success: number; errors: number }>;

  const hourly = db.prepare(`
    SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
    FROM activities
    WHERE timestamp >= datetime('now', '-30 days')
    GROUP BY hour
    ORDER BY count DESC
    LIMIT 24
  `).all() as Array<{ hour: string; count: number }>;

  return {
    ...stats,
    heatmap,
    trend,
    hourly,
  };
}

export function resetActivitiesDbForTests(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
  _dbPath = null;
}
