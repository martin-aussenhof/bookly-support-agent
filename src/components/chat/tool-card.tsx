"use client";

import { AlertTriangle, Check, ChevronDown, Loader2, Wrench } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
 */
export function ToolCard({ tool }: { tool: ToolItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "bg-card rounded-lg border text-sm",
          tool.status === "error" && "border-destructive/40 bg-destructive/5",
          tool.mutating && tool.status === "ok" && "border-primary/40",
        )}
      >
        <CollapsibleTrigger className="hover:bg-accent/40 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors">
          <StatusIcon status={tool.status} />

          <span className="font-mono text-xs font-medium">{tool.name}</span>

          {tool.mutating && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tracking-wide uppercase">
              action
            </Badge>
          )}

          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {tool.summary ?? "Working…"}
          </span>

          <ChevronDown
            className={cn(
              "text-muted-foreground size-3.5 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-3 py-2.5">
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
  return <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
        <Wrench className="size-3" />
        {label}
      </div>
      <pre className="bg-muted/60 max-h-64 overflow-auto rounded-md p-2.5 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
