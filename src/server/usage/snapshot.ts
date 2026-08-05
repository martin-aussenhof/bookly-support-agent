import "server-only";

import { AGENT_CONFIG } from "@/agent/config";
import type { UsageSnapshot } from "@/types/usage";
import { getPricing, isPriced } from "./pricing";
import { getTotals } from "./store";

/**
 * Totals plus the pricing they were calculated with.
 *
 * Shared by the server-rendered page and `GET /api/usage`, so the first paint
 * and every later refresh cannot disagree about what the meter means.
 */
export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const totals = await getTotals();
  const pricing = getPricing(AGENT_CONFIG.model);

  return {
    ...totals,
    model: AGENT_CONFIG.model,
    modelLabel: pricing.label,
    inputPerMTok: pricing.inputPerMTok,
    outputPerMTok: pricing.outputPerMTok,
    priced: isPriced(AGENT_CONFIG.model),
  };
}
