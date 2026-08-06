"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Composer } from "@/components/chat/composer";
import { CostMeter } from "@/components/chat/cost-meter";
import { EmptyState } from "@/components/chat/empty-state";
import { Transcript } from "@/components/chat/transcript";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useUsageMeter } from "@/hooks/use-usage-meter";
import type { TranscriptItem } from "@/types/chat";
import type { UsageSnapshot } from "@/types/usage";

interface ChatPanelProps {
  initialUsage: UsageSnapshot;
  /** The stored conversation, server-rendered from the session cookie. */
  initialItems: TranscriptItem[];
}

export function ChatPanel({ initialUsage, initialItems }: ChatPanelProps) {
  const router = useRouter();
  const [isResetting, startReset] = useTransition();

  const { snapshot, refresh, applyTotal } = useUsageMeter(initialUsage);
  const { items, isStreaming, send, setItems } = useAgentChat(initialItems, {
    // Move the meter the instant the turn ends, then re-sync so spend from
    // other users lands too.
    onTotalCost: (total) => {
      applyTotal(total);
      void refresh();
    },
  });

  // The server owns the session, so "new chat" is a server operation: drop the
  // stored transcript and rotate the cookie, then re-render from the new state.
  const reset = useCallback(() => {
    startReset(async () => {
      await fetch("/api/chat", { method: "DELETE" });
      setItems([]);
      router.refresh();
    });
  }, [router, setItems]);

  return (
    // `data-streaming` lets an end-to-end test await a turn without polling text.
    <div
      className="app-ambient flex h-dvh flex-col"
      data-testid="chat-panel"
      data-streaming={isStreaming ? "true" : "false"}
    >
      <header className="bg-background/70 supports-backdrop-filter:bg-background/55 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-360 items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <Wordmark />

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <CostMeter snapshot={snapshot} />

            <Separator orientation="vertical" className="hidden h-6! sm:block" />

            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
              onClick={reset}
              disabled={(items.length === 0 && !isStreaming) || isResetting}
              data-testid="new-chat"
            >
              <RotateCcw className="size-3.5" />
              New chat
            </Button>

            {/* Icon-only on small screens, where the label does not fit. */}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full sm:hidden"
              onClick={reset}
              disabled={(items.length === 0 && !isStreaming) || isResetting}
              aria-label="Start a new chat"
            >
              <RotateCcw className="size-4" />
            </Button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Transcript items={items} empty={<EmptyState onPick={send} />} />
      </main>

      <Composer disabled={isStreaming} onSend={send} />
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className="from-primary to-primary/75 text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br shadow-sm sm:size-9"
        aria-hidden
      >
        {/*
          Identical geometry to `src/app/icon.svg`, minus the tile — the header
          already provides that. Same viewBox on purpose: the tab and the header
          should show one mark, not two that merely rhyme.
        */}
        <svg viewBox="0 0 32 32" fill="none" className="size-4 sm:size-[1.15rem]">
          <rect x="5.4" y="7.5" width="6" height="17" rx="1.8" fill="currentColor" />
          <rect
            x="13.4"
            y="7.5"
            width="6"
            height="17"
            rx="1.8"
            fill="currentColor"
            opacity="0.95"
          />
          <rect
            x="21.2"
            y="8"
            width="5.4"
            height="16"
            rx="1.7"
            fill="currentColor"
            opacity="0.8"
            transform="rotate(9 23.9 16)"
          />
        </svg>
      </div>

      <div className="min-w-0 leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-lg leading-none tracking-tight sm:text-xl">
            Bookly
          </span>
          <span className="text-muted-foreground text-2xs font-medium tracking-[0.14em] uppercase">
            Support
          </span>
        </div>
        <p className="text-muted-foreground mt-1 hidden truncate text-xs leading-none md:block">
          AI agent · orders, returns, and policies
        </p>
      </div>
    </div>
  );
}
