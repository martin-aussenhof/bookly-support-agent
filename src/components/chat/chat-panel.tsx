"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Composer } from "@/components/chat/composer";
import { CostMeter } from "@/components/chat/cost-meter";
import { EmptyState } from "@/components/chat/empty-state";
import { Transcript } from "@/components/chat/transcript";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    <div className="app-ambient flex h-dvh flex-col">
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
              disabled={items.length === 0 && !isStreaming}
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
              disabled={items.length === 0 && !isStreaming}
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
        {/* A stacked-spine mark reads as "books" at 16px, where a glyph would not. */}
        <svg viewBox="0 0 24 24" fill="none" className="size-4 sm:size-[1.1rem]">
          <path
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4h2A1.5 1.5 0 0 1 9 5.5v13A1.5 1.5 0 0 1 7.5 20h-2A1.5 1.5 0 0 1 4 18.5v-13ZM11 5.5A1.5 1.5 0 0 1 12.5 4h1A1.5 1.5 0 0 1 15 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-13Z"
            fill="currentColor"
          />
          <path
            d="m17.4 6.6 1.9-.5a1.5 1.5 0 0 1 1.84 1.06l2.6 9.66"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.65"
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
