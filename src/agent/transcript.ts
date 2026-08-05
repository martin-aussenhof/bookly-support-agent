import type { TranscriptItem } from "@/types/chat";
import type { AgentEvent } from "./events";

/**
 * The transcript reducer — the single definition of how agent events become
 * renderable items.
 *
 * Both sides run this: the browser folds the live SSE stream through it, and
 * the agent loop folds the same events through it to build the copy it
 * persists. One implementation means a rehydrated conversation is identical to
 * the one you just watched stream in, rather than a lookalike rebuilt by a
 * second piece of code that will eventually drift.
 *
 * Pure — no I/O, no module state — so it is equally safe on the server and in
 * a React state updater.
 */

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

export function appendUserMessage(items: TranscriptItem[], text: string): TranscriptItem[] {
  return [...items, { kind: "message", id: newId("usr"), role: "user", text }];
}

export function applyAgentEvent(items: TranscriptItem[], event: AgentEvent): TranscriptItem[] {
  switch (event.type) {
    case "message_start":
      return [
        ...items,
        { kind: "message", id: newId("msg"), role: "assistant", text: "", streaming: true },
      ];

    case "text_delta": {
      const index = findLastStreamingMessage(items);
      if (index === -1) return items;
      const message = items[index];
      if (message.kind !== "message") return items;

      const next = [...items];
      next[index] = { ...message, text: message.text + event.text };
      return next;
    }

    case "tool_call":
      return [
        ...seal(items),
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
      return items.map((item) =>
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
      return [
        ...seal(items),
        {
          kind: "usage",
          id: newId("use"),
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          costUsd: event.turnCostUsd,
          estimated: event.estimated,
        },
      ];

    case "notice":
      return [
        ...seal(items),
        { kind: "notice", id: newId("note"), tone: "info", text: event.message },
      ];

    case "error":
      return [
        ...seal(items),
        {
          kind: "notice",
          id: newId("err"),
          tone: "error",
          text: event.message,
          ...(event.detail && { detail: event.detail }),
        },
      ];

    case "done":
      return seal(items);
  }
}

function findLastStreamingMessage(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "message" && item.streaming) return i;
  }
  return -1;
}

/**
 * Closes any open assistant message so the next card renders after it rather
 * than inside it, and drops assistant turns that produced no text (the model
 * went straight to a tool call).
 */
function seal(items: TranscriptItem[]): TranscriptItem[] {
  return items
    .map((item) =>
      item.kind === "message" && item.streaming ? { ...item, streaming: false } : item,
    )
    .filter((item) => !(item.kind === "message" && item.role === "assistant" && !item.text));
}
