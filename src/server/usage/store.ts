import "server-only";

import { neon } from "@neondatabase/serverless";

import { ZERO_TOTALS, type UsageEvent, type UsageTotals } from "./types";

/**
 * The usage ledger.
 *
 * Backed by Neon (Postgres) when `DATABASE_URL` is set, and by an in-memory
 * counter when it is not — so the app runs out of the box and the cost meter
 * simply reports `persistent: false` instead of the page failing to load.
 *
 * The meter is global on purpose: it answers "what has this agent cost us so
 * far, across everyone who has used it", which is the number that decides
 * whether a model choice is viable in production.
 */

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

export const isPersistent = sql !== null;

/** In-memory fallback. Process-local; resets on restart. */
const memory: UsageEvent[] = [];

/** Table creation is attempted once per process, then cached. */
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS usage_events (
        id                BIGSERIAL PRIMARY KEY,
        session_id        TEXT        NOT NULL,
        model             TEXT        NOT NULL,
        prompt_tokens     INTEGER     NOT NULL,
        completion_tokens INTEGER     NOT NULL,
        cost_usd          NUMERIC(18, 10) NOT NULL,
        estimated         BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS usage_events_created_at_idx
        ON usage_events (created_at DESC)
    `;
  })();
  return schemaReady;
}

/**
 * Records one model call. Never throws: a metering failure must not take down a
 * customer conversation, so problems are logged and the turn continues.
 */
export async function recordUsage(event: UsageEvent): Promise<void> {
  if (!sql) {
    memory.push(event);
    return;
  }

  try {
    await ensureSchema();
    await sql`
      INSERT INTO usage_events
        (session_id, model, prompt_tokens, completion_tokens, cost_usd, estimated)
      VALUES
        (${event.sessionId}, ${event.model}, ${event.promptTokens},
         ${event.completionTokens}, ${event.costUsd}, ${event.estimated})
    `;
  } catch (error) {
    console.error("[usage] failed to record usage event", error);
    memory.push(event);
  }
}

export async function getTotals(): Promise<UsageTotals> {
  if (!sql) return totalsFromMemory();

  try {
    await ensureSchema();
    const [row] = await sql`
      SELECT
        COALESCE(SUM(cost_usd), 0)                         AS total_cost_usd,
        COALESCE(SUM(prompt_tokens), 0)                    AS total_prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)                AS total_completion_tokens,
        COUNT(*)                                           AS request_count,
        COUNT(DISTINCT session_id)                         AS session_count,
        COUNT(*) FILTER (WHERE estimated)                  AS estimated_count
      FROM usage_events
    `;

    return {
      // NUMERIC and BIGINT come back as strings from node-postgres — parse them
      // rather than letting "0.0031" land in the UI as a string.
      totalCostUsd: Number(row.total_cost_usd),
      totalPromptTokens: Number(row.total_prompt_tokens),
      totalCompletionTokens: Number(row.total_completion_tokens),
      requestCount: Number(row.request_count),
      sessionCount: Number(row.session_count),
      estimatedCount: Number(row.estimated_count),
      persistent: true,
    };
  } catch (error) {
    console.error("[usage] failed to read totals", error);
    return { ...totalsFromMemory(), persistent: false };
  }
}

function totalsFromMemory(): UsageTotals {
  if (memory.length === 0) return ZERO_TOTALS;

  return memory.reduce<UsageTotals>(
    (totals, event) => ({
      totalCostUsd: totals.totalCostUsd + event.costUsd,
      totalPromptTokens: totals.totalPromptTokens + event.promptTokens,
      totalCompletionTokens: totals.totalCompletionTokens + event.completionTokens,
      requestCount: totals.requestCount + 1,
      sessionCount: totals.sessionCount,
      estimatedCount: totals.estimatedCount + (event.estimated ? 1 : 0),
      persistent: false,
    }),
    { ...ZERO_TOTALS, sessionCount: new Set(memory.map((e) => e.sessionId)).size },
  );
}
