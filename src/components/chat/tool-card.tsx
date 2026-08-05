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
 * Renders one tool invocation in the transcript.
 *
 * Tool use is shown, not hidden. A support agent that silently "knows" an order
 * status is indistinguishable from one that made it up; showing the call and
 * letting a reviewer expand the raw payload is what makes the answer auditable.
 *
 * Visually it sits *quieter* than the conversation — it is evidence, not the
 * answer — until something goes wrong or a write action fires, at which point
 * the accent border pulls it forward.
 */
export function ToolCard({ tool }: { tool: ToolItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="sm:pl-4">
      <div
        className={cn(
          "bg-card/60 overflow-hidden rounded-xl border backdrop-blur-sm transition-colors",
          tool.status === "error" && "border-destructive/35 bg-destructive/5",
          tool.mutating && tool.status === "ok" && "border-primary/35 bg-primary/5",
        )}
      >
        <CollapsibleTrigger className="hover:bg-accent/40 focus-visible:ring-ring/60 flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <StatusIcon status={tool.status} />

          <span className="font-mono text-[11px] font-medium tracking-tight">{tool.name}</span>

          {tool.mutating && (
            <span className="bg-primary/12 text-primary hidden rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-widest uppercase sm:inline-block">
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
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] uppercase">
        <Zap className="size-2.5" />
        {label}
      </div>
      <pre className="bg-muted/50 max-h-72 overflow-auto rounded-lg p-2.5 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
