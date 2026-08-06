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
}

export function Transcript({ items, empty }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  return (
    <ScrollArea className="h-full">
      <div className="measure flex flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {items.length === 0 ? empty : items.map((item) => <Item key={item.id} item={item} />)}
        <div ref={bottomRef} className="h-2" />
      </div>
    </ScrollArea>
  );
}

function Item({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "message":
      return <MessageBubble message={item} />;

    case "tool":
      return <ToolCard tool={item} />;

    case "usage":
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
