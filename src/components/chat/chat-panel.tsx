"use client";

import { BookOpen, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Composer } from "@/components/chat/composer";
import { CostMeter } from "@/components/chat/cost-meter";
import { EmptyState } from "@/components/chat/empty-state";
import { Transcript } from "@/components/chat/transcript";
import { Button } from "@/components/ui/button";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useUsageMeter } from "@/hooks/use-usage-meter";
import type { UsageSnapshot } from "@/types/usage";

export function ChatPanel({ initialUsage }: { initialUsage: UsageSnapshot }) {
  // One session per page load. The id is the only handle the client has on
  // server-side conversation state.
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const { snapshot, refresh, applyTotal } = useUsageMeter(initialUsage);
  const { items, isStreaming, send, reset } = useAgentChat(sessionId, {
    // Move the meter the instant the turn ends, then re-sync so spend from
    // other users lands too.
    onTotalCost: (total) => {
      applyTotal(total);
      void refresh();
    },
  });

  return (
    <div className="bg-background flex h-dvh flex-col">
      <header className="flex items-center gap-2.5 border-b px-4 py-3">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <BookOpen className="size-4" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm leading-tight font-semibold">Bookly Support</h1>
          <p className="text-muted-foreground text-xs leading-tight">
            AI agent · orders, returns, and policies
          </p>
        </div>

        <CostMeter snapshot={snapshot} />

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={items.length === 0 && !isStreaming}
        >
          <RotateCcw className="size-3.5" />
          New chat
        </Button>
      </header>

      <main className="min-h-0 flex-1">
        <Transcript items={items} empty={<EmptyState onPick={send} />} />
      </main>

      <footer className="border-t">
        <Composer disabled={isStreaming} onSend={send} />
      </footer>
    </div>
  );
}
