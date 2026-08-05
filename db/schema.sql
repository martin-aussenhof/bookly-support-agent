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
