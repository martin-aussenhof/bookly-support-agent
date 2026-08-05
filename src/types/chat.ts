/**
 * The client-side view of a conversation.
 *
 * A flat, ordered transcript rather than tool calls nested inside messages:
 * the agent genuinely interleaves talking and acting, and showing it that way
 * is the point — the customer (and the reviewer) can see exactly what the agent
 * did and on what evidence.
 */

export type TranscriptItem = MessageItem | ToolItem | UsageItem | NoticeItem;

export interface MessageItem {
  kind: "message";
  id: string;
  role: "user" | "assistant";
  text: string;
  /** True while tokens are still arriving. */
  streaming?: boolean;
}

export type ToolStatus = "running" | "ok" | "error";

export interface ToolItem {
  kind: "tool";
  id: string;
  name: string;
  input: unknown;
  /** Write actions get a stronger visual treatment. */
  mutating: boolean;
  status: ToolStatus;
  summary?: string;
  data?: unknown;
}

/** What this single turn cost, shown as a faint footnote under the reply. */
export interface UsageItem {
  kind: "usage";
  id: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  estimated: boolean;
}

export interface NoticeItem {
  kind: "notice";
  id: string;
  /** `info` is a calm system note (a handover); `error` is a failure. */
  tone: "error" | "info";
  text: string;
  /** Raw diagnostic, development only. Never shown in production. */
  detail?: string;
}
