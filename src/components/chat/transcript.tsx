"use client";

import { AlertTriangle, UserRoundCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ToolCard } from "@/components/chat/tool-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptItem } from "@/types/chat";

interface TranscriptProps {
  items: TranscriptItem[];
  empty: React.ReactNode;
  /** Show the machinery: raw tool payloads and what the turn cost. */
  inspect: boolean;
}

export function Transcript({ items, empty, inspect }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  return (
    <ScrollArea className="h-full">
      <div className="measure flex flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {items.length === 0
          ? empty
          : visible(items, inspect).map((item) => (
              <Item key={item.id} item={item} inspect={inspect} />
            ))}
        <div ref={bottomRef} className="h-2" />
      </div>
    </ScrollArea>
  );
}

/**
 * Collapses runs of identical activity in the customer view.
 *
 * The model sometimes issues the same read-only call two or three times in one
 * turn — harmless, and its own business, but rendered plainly it becomes
 * "Checked your order" three times over, which reads as a stutter rather than
 * as work. Consecutive tool items that would print the same line become one.
 *
 * Only in the customer view. A reviewer is looking precisely for how many calls
 * were made and with what arguments, so the inspect view hides nothing.
 */
function visible(items: TranscriptItem[], inspect: boolean): TranscriptItem[] {
  if (inspect) return items;

  return items.filter((item, index) => {
    if (item.kind !== "tool") return true;
    const previous = items[index - 1];
    return !(
      previous?.kind === "tool" &&
      previous.name === item.name &&
      previous.status === item.status
    );
  });
}

function Item({ item, inspect }: { item: TranscriptItem; inspect: boolean }) {
  switch (item.kind) {
    case "message":
      return <MessageBubble message={item} />;

    case "tool":
      return <ToolCard tool={item} inspect={inspect} />;

    case "usage":
      // Token counts belong to whoever is evaluating the agent, not to someone
      // waiting on a refund. The header meter still carries the running total.
      if (!inspect) return null;
      return (
        <p
          data-testid="turn-usage"
          className="text-muted-foreground/70 font-mono text-3xs tracking-tight sm:pl-4"
        >
          {item.estimated && "~"}
          {item.promptTokens.toLocaleString()} in · {item.completionTokens.toLocaleString()} out
          {" · "}
          {item.costUsd < 0.01 ? `$${item.costUsd.toFixed(5)}` : `$${item.costUsd.toFixed(4)}`}
          {item.estimated && " (estimated)"}
        </p>
      );

    case "notice":
      return (
        <Alert
          data-testid="notice"
          data-tone={item.tone}
          variant={item.tone === "error" ? "destructive" : "default"}
          className="rounded-xl"
        >
          {item.tone === "error" ? (
            <AlertTriangle className="size-4" />
          ) : (
            <UserRoundCheck className="size-4" />
          )}
          <AlertDescription>
            {item.text}
            {item.detail && (
              <span className="text-muted-foreground mt-1.5 block font-mono text-3xs break-all">
                {item.detail}
              </span>
            )}
          </AlertDescription>
        </Alert>
      );
  }
}
