/**
 * The wire protocol between the agent loop and the browser.
 *
 * The agent loop yields these; the route serialises them as SSE; the client
 * hook folds them back into UI state. One union type keeps all three honest.
 */
export type AgentEvent =
  /** Model started producing a visible assistant message. */
  | { type: "message_start" }
  /** Incremental assistant text. */
  | { type: "text_delta"; text: string }
  /** Model asked for a tool; arguments are final at this point. */
  | { type: "tool_call"; id: string; name: string; input: unknown; mutating: boolean }
  /** Tool finished. `data` is what the model will see. */
  | {
      type: "tool_result";
      id: string;
      name: string;
      summary: string;
      isError: boolean;
      data: unknown;
    }
  /**
   * Cost accounting for the whole user turn (which may span several model
   * calls), plus the new global running total. Emitted once, just before `done`.
   */
  | {
      type: "usage";
      model: string;
      promptTokens: number;
      completionTokens: number;
      turnCostUsd: number;
      totalCostUsd: number;
      /** True if any model call in the turn fell back to estimated token counts. */
      estimated: boolean;
    }
  /** Turn complete — no further events for this request. */
  | { type: "done"; finishReason: string | null; iterations: number }
  /** Unrecoverable failure; the turn is over. */
  | { type: "error"; message: string };
