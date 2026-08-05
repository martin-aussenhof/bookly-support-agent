import type { UsageTotals } from "@/server/usage/types";

/** Shape returned by `GET /api/usage`. */
export interface UsageSnapshot extends UsageTotals {
  model: string;
  modelLabel: string;
  inputPerMTok: number;
  outputPerMTok: number;
  priced: boolean;
}
