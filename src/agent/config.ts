/**
 * Model and loop configuration, in one place so the tradeoffs are reviewable.
 */
export const AGENT_CONFIG = {
  /**
   * Together AI model id. Must match a key in
   * `src/server/usage/pricing.ts` — otherwise the cost meter counts the
   * requests but prices them at zero.
   *
   * GPT-OSS 120B is the default: reliable tool calling at $0.15/$0.60 per
   * MTok, which is the right shape for high-volume support traffic.
   */
  model: "openai/gpt-oss-120b",

  /**
   * Low but non-zero. Support answers should be near-deterministic for the same
   * question; zero tends to make models loop on a phrasing when a tool errors.
   */
  temperature: 0.2,

  maxTokens: 2048,

  /**
   * Hard ceiling on model<->tool round trips per user message. Protects against
   * a pathological loop; hitting it is an incident worth logging, not a normal
   * outcome.
   */
  maxIterations: 8,

  /** Turns of history kept in context. Older turns are dropped oldest-first. */
  maxHistoryMessages: 40,
} as const;
