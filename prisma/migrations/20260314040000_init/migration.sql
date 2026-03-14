CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "duration_ms" INTEGER,
    "tokens_used" INTEGER,
    "agent" TEXT,
    "metadata" TEXT
);

CREATE TABLE "usage_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "agent_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" REAL NOT NULL,
    "created_at" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX "idx_activities_timestamp" ON "activities"("timestamp");
CREATE INDEX "idx_activities_type" ON "activities"("type");
CREATE INDEX "idx_activities_status" ON "activities"("status");
CREATE INDEX "idx_activities_agent" ON "activities"("agent");

CREATE INDEX "idx_date" ON "usage_snapshots"("date");
CREATE INDEX "idx_agent" ON "usage_snapshots"("agent_id");
CREATE INDEX "idx_model" ON "usage_snapshots"("model");
CREATE INDEX "idx_timestamp" ON "usage_snapshots"("timestamp");
