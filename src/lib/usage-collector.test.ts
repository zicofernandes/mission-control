import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { collectUsage, queryGatewayUsage } from "./usage-collector";

test("queryGatewayUsage fetches both gateway ports and tags sessions with agent", async () => {
  const fetchCalls: string[] = [];

  const sessions = await queryGatewayUsage(
    (async (input: string | URL | Request) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url === "http://localhost:18789/api/sessions") {
        return new Response(
          JSON.stringify([
            {
              key: "agent:main:main",
              model: "sonnet",
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              updatedAt: 100,
            },
          ]),
          { headers: { "content-type": "application/json" } },
        );
      }

      if (url === "http://localhost:19001/api/sessions") {
        return new Response(
          JSON.stringify({
            sessions: [
              {
                key: "agent:main:main",
                model: "haiku",
                inputTokens: 20,
                outputTokens: 8,
                totalTokens: 28,
                updatedAt: 200,
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch,
  );

  assert.deepEqual(fetchCalls, [
    "http://localhost:18789/api/sessions",
    "http://localhost:19001/api/sessions",
  ]);
  assert.deepEqual(
    sessions.map(({ agent, key, model, totalTokens }) => ({
      agent,
      key,
      model,
      totalTokens,
    })),
    [
      {
        agent: "athena",
        key: "agent:main:main",
        model: "sonnet",
        totalTokens: 15,
      },
      {
        agent: "elon",
        key: "agent:main:main",
        model: "haiku",
        totalTokens: 28,
      },
    ],
  );
});

test("collectUsage merges gateway usage into per-agent snapshots", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "mission-control-usage-"));
  const dbPath = path.join(tempDir, "usage.db");
  const realNow = Date.now;

  Date.now = () => new Date("2026-03-11T15:00:00.000Z").getTime();

  try {
    await collectUsage(
      dbPath,
      (async (input: string | URL | Request) => {
        const url = String(input);

        if (url === "http://localhost:18789/api/sessions") {
          return new Response(
            JSON.stringify([
              {
                key: "athena:session:1",
                model: "sonnet",
                inputTokens: 1000,
                outputTokens: 500,
                totalTokens: 1500,
                updatedAt: 111,
              },
              {
                key: "athena:session:2",
                model: "sonnet",
                inputTokens: 2000,
                outputTokens: 1000,
                totalTokens: 3000,
                updatedAt: 222,
              },
            ]),
            { headers: { "content-type": "application/json" } },
          );
        }

        if (url === "http://localhost:19001/api/sessions") {
          return new Response(
            JSON.stringify([
              {
                key: "elon:session:1",
                model: "haiku",
                inputTokens: 4000,
                outputTokens: 1500,
                totalTokens: 5500,
                updatedAt: 333,
              },
            ]),
            { headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected URL: ${url}`);
      }) as typeof fetch,
    );

    const db = new Database(dbPath, { readonly: true });

    try {
      const rows = db
        .prepare(
          `SELECT agent_id, model, input_tokens, output_tokens, total_tokens
           FROM usage_snapshots
           ORDER BY agent_id ASC`,
        )
        .all() as Array<{
        agent_id: string;
        model: string;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      }>;

      assert.deepEqual(rows, [
        {
          agent_id: "athena",
          model: "anthropic/claude-sonnet-4-5",
          input_tokens: 3000,
          output_tokens: 1500,
          total_tokens: 4500,
        },
        {
          agent_id: "elon",
          model: "anthropic/claude-haiku-3-5",
          input_tokens: 4000,
          output_tokens: 1500,
          total_tokens: 5500,
        },
      ]);
    } finally {
      db.close();
    }
  } finally {
    Date.now = realNow;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
