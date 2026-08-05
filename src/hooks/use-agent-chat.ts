"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentEvent } from "@/agent/events";
import { appendUserMessage, applyAgentEvent } from "@/agent/transcript";
import { readSSEStream } from "@/lib/sse";
import type { TranscriptItem } from "@/types/chat";

interface UseAgentChatOptions {
  /** Called with the new global spend total whenever a turn finishes. */
  onTotalCost?: (totalCostUsd: number) => void;
}

/**
 * Owns the client half of the wire protocol: post a message, fold the resulting
 * `AgentEvent` stream into transcript state.
 *
 * The folding itself lives in `@/agent/transcript` and is shared with the
 * server, so what you watch stream in and what gets persisted cannot diverge.
 * Conversation state is server-owned; this hook is a projection of it, seeded
 * with the server-rendered transcript.
 */
export function useAgentChat(initialItems: TranscriptItem[], options: UseAgentChatOptions = {}) {
  const [items, setItems] = useState<TranscriptItem[]>(initialItems);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Kept in a ref so `applyEvent` does not change identity when the caller
  // passes an inline callback. Synced in an effect rather than during render.
  const onTotalCostRef = useRef(options.onTotalCost);
  useEffect(() => {
    onTotalCostRef.current = options.onTotalCost;
  }, [options.onTotalCost]);

  // Abort an in-flight turn if the component goes away, so we stop reading a
  // stream nobody is rendering. The server persists whatever it had.
  useEffect(() => () => abortRef.current?.abort(), []);

  const applyEvent = useCallback((event: AgentEvent) => {
    if (event.type === "usage") onTotalCostRef.current?.(event.totalCostUsd);
    setItems((current) => applyAgentEvent(current, event));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setItems((current) => appendUserMessage(current, trimmed));
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`The agent is unavailable (HTTP ${response.status}).`);
        }

        for await (const event of readSSEStream<AgentEvent>(response.body)) {
          applyEvent(event);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        applyEvent({
          type: "error",
          message: error instanceof Error ? error.message : "Connection lost.",
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [applyEvent, isStreaming],
  );

  return { items, isStreaming, send, setItems };
}
