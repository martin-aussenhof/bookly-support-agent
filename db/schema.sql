-- Bookly agent — usage ledger.
--
-- Applied automatically (idempotently) on first write, so a fresh Neon database
-- needs no migration step. Kept here as the readable source of truth.

CREATE TABLE IF NOT EXISTS usage_events (
  id                BIGSERIAL PRIMARY KEY,
  session_id        TEXT        NOT NULL,
  model             TEXT        NOT NULL,
  prompt_tokens     INTEGER     NOT NULL,
  completion_tokens INTEGER     NOT NULL,
  -- 10 decimal places: a single cheap request can cost well under a cent, and
  -- rounding those to zero would make the running total drift low over time.
  cost_usd          NUMERIC(18, 10) NOT NULL,
  estimated         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_created_at_idx
  ON usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_session_id_idx
  ON usage_events (session_id);

-- Conversations, keyed by the httpOnly session cookie.
--
-- `messages` is what the model reads; `transcript` is what the browser renders.
-- Both are written in the same statement so a rehydrated conversation matches
-- the one the customer watched stream in.
--
-- ⚠ Personal data: transcripts contain customer emails and order history.
-- Rows are swept after 30 days (see sweepExpiredSessions).

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  messages   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  facts      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  transcript JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx
  ON chat_sessions (updated_at DESC);
