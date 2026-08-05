/** One model call's token usage, ready to be persisted. */
export interface UsageEvent {
  sessionId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /**
   * True when the token counts were estimated rather than reported by Together.
   * Together's streaming schema marks `usage` as nullable and has no
   * `stream_options.include_usage`, so this is a real possibility — and a meter
   * that silently guesses is worse than one that admits it.
   */
  estimated: boolean;
}

/** Aggregate spend across every session, which is what the meter displays. */
export interface UsageTotals {
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  requestCount: number;
  sessionCount: number;
  /** How many of the recorded requests used estimated token counts. */
  estimatedCount: number;
  /** False when running on the in-memory fallback (no DATABASE_URL). */
  persistent: boolean;
}

export const ZERO_TOTALS: UsageTotals = {
  totalCostUsd: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  requestCount: 0,
  sessionCount: 0,
  estimatedCount: 0,
  persistent: false,
};
