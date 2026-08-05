"use client";

import { Database, HardDriveDownload, TriangleAlert } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UsageSnapshot } from "@/types/usage";

/**
 * Running spend across every session, not just this browser's.
 *
 * Displayed next to the chat because that is the number that decides whether a
 * model choice survives contact with production traffic — cost per resolved
 * conversation is the metric a CX team actually buys on.
 */
export function CostMeter({ snapshot }: { snapshot: UsageSnapshot }) {
  const perConversation =
    snapshot.sessionCount > 0 ? snapshot.totalCostUsd / snapshot.sessionCount : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="bg-card/70 hover:border-primary/30 focus-visible:ring-ring/60 flex items-center gap-2 rounded-full border py-1 pr-3 pl-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-accent text-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
            <MeterIcon snapshot={snapshot} />
          </span>

          <span className="leading-none">
            <span className="block font-mono text-[0.8125rem] font-semibold">
              {formatUsd(snapshot.totalCostUsd)}
            </span>
            <span className="text-muted-foreground mt-0.5 hidden text-3xs font-medium tracking-widest uppercase lg:block">
              total spend
            </span>
          </span>
        </button>
      </TooltipTrigger>

      <TooltipContent side="bottom" align="end" className="max-w-xs p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <Row label="Model" value={snapshot.modelLabel} />
          <Row
            label="Rate"
            value={`$${snapshot.inputPerMTok} / $${snapshot.outputPerMTok} per 1M`}
          />
          <Row label="Conversations" value={snapshot.sessionCount.toLocaleString()} />
          <Row label="Model calls" value={snapshot.requestCount.toLocaleString()} />
          <Row
            label="Tokens"
            value={`${snapshot.totalPromptTokens.toLocaleString()} in · ${snapshot.totalCompletionTokens.toLocaleString()} out`}
          />
          <Row label="Per conversation" value={formatUsd(perConversation)} />
        </dl>

        <p className="text-muted-foreground mt-2.5 border-t pt-2.5 text-2xs leading-relaxed">
          {!snapshot.priced
            ? "This model has no row in pricing.ts, so calls are counted but priced at $0."
            : snapshot.persistent
              ? "Aggregated across all users from Neon."
              : "In-memory only — set DATABASE_URL to persist across restarts."}
          {snapshot.estimatedCount > 0 &&
            ` ${snapshot.estimatedCount} of ${snapshot.requestCount} calls used estimated token counts.`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function MeterIcon({ snapshot }: { snapshot: UsageSnapshot }) {
  if (!snapshot.priced) {
    return <TriangleAlert className="size-3 text-amber-600 dark:text-amber-400" />;
  }
  return snapshot.persistent ? (
    <Database className="size-3" />
  ) : (
    <HardDriveDownload className="size-3" />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground whitespace-nowrap">{label}</dt>
      <dd className="text-right font-mono">{value}</dd>
    </>
  );
}

/**
 * Sub-cent totals are the normal case early on, so a plain 2-decimal format
 * would show "$0.00" for a meter that is genuinely moving.
 */
function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
