"use client";

import { AlertTriangle, Check, ChevronDown, Loader2, Zap } from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolItem } from "@/types/chat";

/**
 * What the agent is doing, said to the customer.
 *
 * Written as the agent speaking to the person it is helping — "I've checked
 * your order", not "lookup_order ok" and not "Checked your order" either, which
 * is still a log line with the pronouns filed off. Nothing here names an
 * internal system: a customer has no model of a "help centre index" or an
 * "order service", so these say what it means for them.
 *
 * Keyed on the tool and its outcome rather than on anything the backend
 * returned, so this cannot leak a payload even by accident. `lookup_order`
 * failing for a missing order and failing because the email belongs to someone
 * else deliberately read the same: the customer is told what to do next by the
 * agent's own reply, and the difference between those two is not their business.
 */
const ACTIVITY: Record<string, Record<ToolItem["status"], string>> = {
  lookup_order: {
    running: "Looking up your order…",
    ok: "I've pulled up your order",
    error: "I couldn't find that order",
  },
  search_help_center: {
    running: "Checking our policies…",
    ok: "I've checked our policies",
    error: "I couldn't check our policies",
  },
  start_return: {
    running: "Setting up your return…",
    ok: "I've set up your return",
    error: "I couldn't set up that return",
  },
  escalate_to_human: {
    running: "Finding someone to help…",
    ok: "I've passed this to a colleague",
    error: "I couldn't reach a colleague",
  },
};

/** Used when a capability is added and nobody writes it a line here. */
const FALLBACK: Record<ToolItem["status"], string> = {
  running: "Working on that…",
  ok: "Done",
  error: "That didn't work",
};

function activity(tool: ToolItem): string {
  // Never falls back to the tool's own name: a capability added later must not
  // start leaking its internal name to customers just because this map was missed.
  return ACTIVITY[tool.name]?.[tool.status] ?? FALLBACK[tool.status];
}

/**
 * Renders one tool invocation in the transcript, in one of two views.
 *
 * Tool use is shown, not hidden: a support agent that silently "knows" an order
 * status is indistinguishable from one that made it up, and being able to see
 * the call and its raw result is what makes the answer auditable. But "shown"
 * and "shown to the customer" are different claims. A tool name in monospace
 * and a JSON payload are written for whoever is evaluating the agent, so they
 * live behind the inspect toggle, and the customer gets a plain line saying
 * what happened.
 *
 * Both views carry the same `data-*` attributes: they are the contract the
 * end-to-end specs read, and they describe the call rather than displaying it.
 */
export function ToolCard({ tool, inspect }: { tool: ToolItem; inspect: boolean }) {
  const [open, setOpen] = useState(false);

  if (!inspect) {
    return (
      <div
        data-testid="tool-card"
        data-tool={tool.name}
        data-status={tool.status}
        className="text-muted-foreground flex items-center gap-2 text-xs sm:pl-4"
      >
        <StatusIcon status={tool.status} />
        <span>{activity(tool)}</span>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="sm:pl-4">
      <div
        data-testid="tool-card"
        data-tool={tool.name}
        data-status={tool.status}
        className={cn(
          "bg-card/60 overflow-hidden rounded-xl border backdrop-blur-sm transition-colors",
          tool.status === "error" && "border-destructive/35 bg-destructive/5",
          tool.mutating && tool.status === "ok" && "border-primary/35 bg-primary/5",
        )}
      >
        <CollapsibleTrigger className="hover:bg-accent/40 focus-visible:ring-ring/60 flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <StatusIcon status={tool.status} />

          <span className="font-mono text-2xs font-medium tracking-tight">{tool.name}</span>

          {tool.mutating && (
            <span className="bg-primary/12 text-primary hidden rounded-full px-1.5 py-0.5 text-3xs font-semibold tracking-widest uppercase sm:inline-block">
              action
            </span>
          )}

          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {tool.summary ?? "Working…"}
          </span>

          <ChevronDown
            className={cn(
              "text-muted-foreground/60 size-3.5 shrink-0 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <div className="space-y-2.5 border-t px-3 py-3">
            <Payload label="Input" value={tool.input} />
            {tool.data !== undefined && <Payload label="Result" value={tool.data} />}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function StatusIcon({ status }: { status: ToolItem["status"] }) {
  if (status === "running") {
    return <Loader2 className="text-muted-foreground size-3.5 shrink-0 animate-spin" />;
  }
  if (status === "error") {
    return <AlertTriangle className="text-destructive size-3.5 shrink-0" />;
  }
  return <Check className="text-success size-3.5 shrink-0" />;
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-3xs font-semibold tracking-[0.12em] uppercase">
        <Zap className="size-2.5" />
        {label}
      </div>
      <pre className="bg-muted/50 max-h-72 overflow-auto rounded-lg p-2.5 font-mono text-2xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
