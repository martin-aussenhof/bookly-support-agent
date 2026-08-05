"use client";

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
        <p className="text-muted-foreground/70 font-mono text-[10px] tracking-tight sm:pl-4">
          {item.estimated && "~"}
          {item.promptTokens.toLocaleString()} in · {item.completionTokens.toLocaleString()} out
          {" · "}
          {item.costUsd < 0.01 ? `$${item.costUsd.toFixed(5)}` : `$${item.costUsd.toFixed(4)}`}
          {item.estimated && " (estimated)"}
        </p>
      );

    case "notice":
      return (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{item.text}</AlertDescription>
        </Alert>
      );
  }
}
