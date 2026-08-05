"use client";

import { Database, HardDriveDownload, TriangleAlert } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
        <div className="bg-muted/60 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left">
          <MeterIcon snapshot={snapshot} />
          <div className="leading-none">
            <div className="font-mono text-sm font-semibold tabular-nums">
              {formatUsd(snapshot.totalCostUsd)}
            </div>
            <div className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
              total spend
            </div>
          </div>
        </div>
      </TooltipTrigger>

      <TooltipContent side="bottom" align="end" className="max-w-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <Row label="Model" value={snapshot.modelLabel} />
          <Row
            label="Rate"
            value={`$${snapshot.inputPerMTok}/$${snapshot.outputPerMTok} per 1M in/out`}
          />
          <Row label="Conversations" value={snapshot.sessionCount.toLocaleString()} />
          <Row label="Model calls" value={snapshot.requestCount.toLocaleString()} />
          <Row
            label="Tokens"
            value={`${snapshot.totalPromptTokens.toLocaleString()} in · ${snapshot.totalCompletionTokens.toLocaleString()} out`}
          />
          <Row label="Per conversation" value={formatUsd(perConversation)} />
        </dl>

        <p className="text-muted-foreground mt-2 border-t pt-2 text-[11px]">
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
    return <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  return snapshot.persistent ? (
    <Database className="text-muted-foreground size-3.5 shrink-0" />
  ) : (
    <HardDriveDownload className="text-muted-foreground size-3.5 shrink-0" />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
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
