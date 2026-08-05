"use client";

import { useCallback, useEffect, useState } from "react";

import type { UsageSnapshot } from "@/types/usage";

/**
 * Tracks the global spend total.
 *
 * The first value is server-rendered, so there is no fetch on mount. After
 * that the meter moves two ways: instantly when *this* browser costs money
 * (via `applyTotal` from the chat stream), and on a slow poll so spend from
 * other users lands too.
 */
export function useUsageMeter(initial: UsageSnapshot, pollMs = 30_000) {
  const [snapshot, setSnapshot] = useState<UsageSnapshot>(initial);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (response.ok) setSnapshot((await response.json()) as UsageSnapshot);
    } catch {
      // A metering blip must never surface as a chat error.
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  /** Applies a known total immediately, without waiting for the next poll. */
  const applyTotal = useCallback((totalCostUsd: number) => {
    setSnapshot((current) => ({ ...current, totalCostUsd }));
  }, []);

  return { snapshot, refresh, applyTotal };
}
