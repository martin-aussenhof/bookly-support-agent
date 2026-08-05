import "server-only";

import { emptyFacts, type Session, type SessionFacts } from "./types";

/**
 * In-memory session store.
 *
 * Conversation state lives on the server, not in the browser: the client sends
 * only `{ sessionId, message }`. That keeps tool inputs/results and the system
 * prompt off the wire, and means the transcript the model sees can never be
 * edited by the client. Swap this Map for Redis/Postgres to scale out — the
 * interface is intentionally three functions wide.
 */
const SESSIONS = new Map<string, Session>();

/** Sessions older than this are dropped on next access. */
const TTL_MS = 60 * 60 * 1000;

export function getOrCreateSession(id: string): Session {
  const existing = SESSIONS.get(id);
  if (existing && Date.now() - existing.createdAt < TTL_MS) {
    return existing;
  }

  const session: Session = {
    id,
    createdAt: Date.now(),
    messages: [],
    facts: emptyFacts(),
  };
  SESSIONS.set(id, session);
  return session;
}

export function updateFacts(sessionId: string, patch: Partial<SessionFacts>): void {
  const session = SESSIONS.get(sessionId);
  if (!session) return;
  session.facts = { ...session.facts, ...patch };
}

export function resetSession(id: string): void {
  SESSIONS.delete(id);
}
