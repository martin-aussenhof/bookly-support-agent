import type { z } from "zod";

import type { SessionFacts } from "@/agent/memory/types";

/**
 * Everything a tool is allowed to know about the conversation it runs inside.
 * Tools never see the raw transcript — only the facts the agent has verified.
 */
export interface ToolContext {
  sessionId: string;
  facts: SessionFacts;
  /** Lets a tool persist something it established (e.g. a verified email). */
  remember(patch: Partial<SessionFacts>): void;
}

export interface ToolResult {
  /** JSON-serialisable payload returned to the model as the tool result. */
  data: unknown;
  /** One-line human summary rendered in the transcript UI. */
  summary: string;
  isError?: boolean;
}

/**
 * A tool is a typed, self-describing capability. The Zod schema is the single
 * source of truth: it produces the JSON Schema sent to the model *and* validates
 * the arguments the model sends back, so a hallucinated argument shape fails
 * loudly at the boundary instead of inside business logic.
 */
export interface AgentTool<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  /** Written for the model: what it does, and crucially *when* to call it. */
  description: string;
  schema: TSchema;
  /**
   * Write actions. Surfaced prominently in the UI and the natural place to hang
   * a confirmation gate when this moves beyond a prototype.
   */
  mutating?: boolean;
  execute(input: z.infer<TSchema>, ctx: ToolContext): Promise<ToolResult>;
}

/** Helper that preserves the schema's inferred input type through the registry. */
export function defineTool<TSchema extends z.ZodType>(
  tool: AgentTool<TSchema>,
): AgentTool<TSchema> {
  return tool;
}
