"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentEvent } from "@/agent/events";
import { readSSEStream } from "@/lib/sse";
import type { TranscriptItem } from "@/types/chat";

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`;

/**
 * Owns the client half of the wire protocol: post a message, fold the resulting
 * `AgentEvent` stream into transcript state. All conversation state lives on the
 * server, so this hook is a projection — never a source of truth.
 */
interface UseAgentChatOptions {
  /** Called with the new global spend total whenever a turn finishes. */
  onTotalCost?: (totalCostUsd: number) => void;
}

export function useAgentChat(sessionId: string, options: UseAgentChatOptions = {}) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Kept in a ref so `applyEvent` does not change identity when the caller
  // passes an inline callback. Synced in an effect rather than during render.
  const onTotalCostRef = useRef(options.onTotalCost);
  useEffect(() => {
    onTotalCostRef.current = options.onTotalCost;
  }, [options.onTotalCost]);

  const applyEvent = useCallback((event: AgentEvent) => {
    setItems((current) => {
      switch (event.type) {
        case "message_start":
          return [
            ...current,
            { kind: "message", id: nextId("msg"), role: "assistant", text: "", streaming: true },
          ];

        case "text_delta": {
          const next = [...current];
          const index = findLastStreamingMessage(next);
          if (index === -1) return next;
          const message = next[index];
          if (message.kind !== "message") return next;
          next[index] = { ...message, text: message.text + event.text };
          return next;
        }

        case "tool_call":
          return [
            ...sealStreamingMessages(current),
            {
              kind: "tool",
              id: event.id,
              name: event.name,
              input: event.input,
              mutating: event.mutating,
              status: "running",
            },
          ];

        case "tool_result":
          return current.map((item) =>
            item.kind === "tool" && item.id === event.id
              ? {
                  ...item,
                  status: event.isError ? "error" : "ok",
                  summary: event.summary,
                  data: event.data,
                }
              : item,
          );

        case "usage":
          onTotalCostRef.current?.(event.totalCostUsd);
          return [
            ...sealStreamingMessages(current),
            {
              kind: "usage",
              id: nextId("use"),
              promptTokens: event.promptTokens,
              completionTokens: event.completionTokens,
              costUsd: event.turnCostUsd,
              estimated: event.estimated,
            },
          ];

        case "error":
          return [
            ...sealStreamingMessages(current),
            { kind: "notice", id: nextId("err"), tone: "error", text: event.message },
          ];

        case "done":
          return sealStreamingMessages(current);
      }
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setItems((current) => [
        ...current,
        { kind: "message", id: nextId("usr"), role: "user", text: trimmed },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: trimmed }),
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
    [applyEvent, isStreaming, sessionId],
  );

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    setItems([]);
    setIsStreaming(false);
    await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  }, [sessionId]);

  return { items, isStreaming, send, reset };
}

function findLastStreamingMessage(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "message" && item.streaming) return i;
  }
  return -1;
}

/** Closes any open assistant message so a tool card renders after it, not inside it. */
function sealStreamingMessages(items: TranscriptItem[]): TranscriptItem[] {
  return items
    .map((item) =>
      item.kind === "message" && item.streaming ? { ...item, streaming: false } : item,
    )
    .filter((item) => !(item.kind === "message" && item.role === "assistant" && !item.text));
}
