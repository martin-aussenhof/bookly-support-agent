import "server-only";

import { neon } from "@neondatabase/serverless";

import { emptyFacts, type Session } from "./types";

/**
 * Session store.
 *
 * Conversation state lives on the server, keyed by an httpOnly cookie: the
 * client posts a message and nothing else. That keeps tool inputs, tool
 * results, and the system prompt off the wire, and means the transcript the
 * model reads cannot be edited by the browser.
 *
 * Backed by Neon when `DATABASE_URL` is set — so a conversation survives a
 * refresh, a closed tab, and a server restart — and by an in-memory Map when
 * it is not, so the app still runs with no database configured.
 *
 * Retention: rows are swept after RETENTION_DAYS. Transcripts contain customer
 * emails and order history, so this table is personal data; see the README.
 */

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

export const isPersistent = sql !== null;

const RETENTION_DAYS = 30;

/** Fallback when there is no database. Process-local; cleared on restart. */
const MEMORY = new Map<string, Session>();

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id         TEXT PRIMARY KEY,
        messages   JSONB       NOT NULL DEFAULT '[]'::jsonb,
        facts      JSONB       NOT NULL DEFAULT '{}'::jsonb,
        transcript JSONB       NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx
        ON chat_sessions (updated_at DESC)
    `;
  })();
  return schemaReady;
}

function blankSession(id: string): Session {
  return { id, createdAt: Date.now(), messages: [], facts: emptyFacts(), transcript: [] };
}

export async function loadSession(id: string): Promise<Session> {
  if (!sql) return MEMORY.get(id) ?? blankSession(id);

  try {
    await ensureSchema();
    const [row] = await sql`
      SELECT id, messages, facts, transcript, created_at
      FROM chat_sessions
      WHERE id = ${id}
        AND updated_at > NOW() - ${`${RETENTION_DAYS} days`}::interval
    `;
    if (!row) return blankSession(id);

    return {
      id: row.id,
      createdAt: new Date(row.created_at).getTime(),
      // JSONB comes back already parsed by the driver.
      messages: row.messages ?? [],
      facts: { ...emptyFacts(), ...(row.facts ?? {}) },
      transcript: row.transcript ?? [],
    };
  } catch (error) {
    console.error("[session] load failed, starting a fresh session", error);
    return blankSession(id);
  }
}

/**
 * Never throws. A persistence failure must not kill a conversation that is
 * otherwise working — the turn continues, it just will not survive a reload.
 */
export async function saveSession(session: Session): Promise<void> {
  if (!sql) {
    MEMORY.set(session.id, session);
    return;
  }

  try {
    await ensureSchema();
    await sql`
      INSERT INTO chat_sessions (id, messages, facts, transcript, updated_at)
      VALUES (
        ${session.id},
        ${JSON.stringify(session.messages)}::jsonb,
        ${JSON.stringify(session.facts)}::jsonb,
        ${JSON.stringify(session.transcript)}::jsonb,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        messages   = EXCLUDED.messages,
        facts      = EXCLUDED.facts,
        transcript = EXCLUDED.transcript,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error("[session] save failed", error);
  }
}

export async function deleteSession(id: string): Promise<void> {
  MEMORY.delete(id);
  if (!sql) return;
  try {
    await ensureSchema();
    await sql`DELETE FROM chat_sessions WHERE id = ${id}`;
  } catch (error) {
    console.error("[session] delete failed", error);
  }
}

/**
 * Retention sweep. Called opportunistically rather than on a cron so the demo
 * needs no scheduler; in production this belongs in a scheduled job.
 */
export async function sweepExpiredSessions(): Promise<number> {
  if (!sql) {
    let removed = 0;
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    for (const [id, session] of MEMORY) {
      if (session.createdAt < cutoff) {
        MEMORY.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  try {
    await ensureSchema();
    const rows = await sql`
      DELETE FROM chat_sessions
      WHERE updated_at < NOW() - ${`${RETENTION_DAYS} days`}::interval
      RETURNING id
    `;
    return rows.length;
  } catch (error) {
    console.error("[session] sweep failed", error);
    return 0;
  }
}
