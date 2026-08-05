/**
 * ============================================================================
 *  TOKEN PRICING — EDIT THIS FILE TO CHANGE COSTS
 * ============================================================================
 *
 * One entry per Together AI model, priced in **US dollars per 1,000,000
 * tokens** — the same unit Together quotes on https://www.together.ai/pricing,
 * so you can copy the numbers straight across without converting anything.
 *
 * These figures were taken from Together's public pricing page and WILL drift.
 * Treat them as a starting point and re-check before quoting anyone a number.
 *
 * To switch models: add or edit a row here, then set `model` in
 * `src/agent/config.ts` to the same key.
 */

export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  inputPerMTok: number;
  /** USD per 1M output (completion) tokens. */
  outputPerMTok: number;
  /** Shown in the UI so the meter says what it is charging for. */
  label: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // --- Cheap, fast, strong tool calling. Default. ---------------------------
  "openai/gpt-oss-120b": {
    label: "GPT-OSS 120B",
    inputPerMTok: 0.15,
    outputPerMTok: 0.6,
  },
  "openai/gpt-oss-20b": {
    label: "GPT-OSS 20B",
    inputPerMTok: 0.05,
    outputPerMTok: 0.2,
  },

  // --- Frontier-ish, more expensive ----------------------------------------
  "deepseek-ai/DeepSeek-V4-Pro": {
    label: "DeepSeek V4 Pro",
    inputPerMTok: 1.74,
    outputPerMTok: 3.48,
  },
  "deepseek-ai/DeepSeek-V4-Flash-0731": {
    label: "DeepSeek V4 Flash",
    inputPerMTok: 0.14,
    outputPerMTok: 0.28,
  },
  "moonshotai/Kimi-K3": {
    label: "Kimi K3",
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
  },
  "moonshotai/Kimi-K2.6": {
    label: "Kimi K2.6",
    inputPerMTok: 1.2,
    outputPerMTok: 4.5,
  },
  "zai-org/GLM-5.2": {
    label: "GLM 5.2",
    inputPerMTok: 0.6,
    outputPerMTok: 2.2,
  },

  // --- Small / legacy -------------------------------------------------------
  "Qwen/Qwen3.5-9B": {
    label: "Qwen 3.5 9B",
    inputPerMTok: 0.17,
    outputPerMTok: 0.25,
  },
  "Qwen/Qwen2.5-7B-Instruct-Turbo": {
    label: "Qwen 2.5 7B Turbo",
    inputPerMTok: 0.3,
    outputPerMTok: 0.3,
  },
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    label: "Llama 3.3 70B Turbo",
    inputPerMTok: 1.04,
    outputPerMTok: 1.04,
  },
};

/** Used when a model has no row above, so an unpriced model reads as 0, not NaN. */
const UNKNOWN_MODEL: ModelPricing = {
  label: "Unpriced model",
  inputPerMTok: 0,
  outputPerMTok: 0,
};

export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? UNKNOWN_MODEL;
}

export function isPriced(model: string): boolean {
  return model in MODEL_PRICING;
}

/** Cost of one request, in USD. */
export function calculateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getPricing(model);
  return (
    (promptTokens / 1_000_000) * pricing.inputPerMTok +
    (completionTokens / 1_000_000) * pricing.outputPerMTok
  );
}
