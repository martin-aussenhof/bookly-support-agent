import { z } from "zod";

import { escalateToHuman } from "./escalate-to-human";
import { lookupOrder } from "./lookup-order";
import { searchHelpCenterTool } from "./search-help-center";
import { startReturn } from "./start-return";
import type { AgentTool, ToolContext, ToolResult } from "./types";

/**
 * The agent's entire capability surface. Adding a tool means adding one file
 * and one line here — the orchestration loop, the API schema, and the UI all
 * derive from this list.
 */
export const TOOLS: AgentTool[] = [
  lookupOrder,
  searchHelpCenterTool,
  startReturn,
  escalateToHuman,
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function getTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name);
}

/** The OpenAI-compatible function-tool shape Together's chat completions expect. */
export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Zod schemas compiled to the JSON Schema sent with every request. */
export function toFunctionTools(): FunctionTool[] {
  return TOOLS.map((tool) => {
    const { $schema, ...parameters } = z.toJSONSchema(tool.schema, {
      target: "draft-7",
      io: "input",
    }) as Record<string, unknown>;
    void $schema;

    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters,
      },
    };
  });
}

/**
 * Runs one tool call. Validation failures and thrown errors are converted into
 * tool results rather than propagated: the model gets to see what went wrong
 * and recover, which is almost always better than killing the turn.
 *
 * `rawArguments` is the JSON *string* the model produced, so malformed JSON is
 * one of the failure modes handled here.
 */
export async function executeTool(
  name: string,
  rawArguments: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return {
      isError: true,
      summary: `Unknown tool "${name}"`,
      data: { error: "unknown_tool", available: TOOLS.map((t) => t.name) },
    };
  }

  let decoded: unknown;
  try {
    decoded = rawArguments.trim() === "" ? {} : JSON.parse(rawArguments);
  } catch {
    return {
      isError: true,
      summary: `Malformed arguments for ${name}`,
      data: {
        error: "invalid_json",
        received: rawArguments.slice(0, 500),
        hint: "Emit the tool arguments as a single valid JSON object and try again.",
      },
    };
  }

  const parsed = tool.schema.safeParse(decoded);
  if (!parsed.success) {
    return {
      isError: true,
      summary: `Invalid arguments for ${name}`,
      data: {
        error: "invalid_arguments",
        issues: z.treeifyError(parsed.error),
        hint: "Fix the arguments and call the tool again, or ask the customer for the missing detail.",
      },
    };
  }

  try {
    return await tool.execute(parsed.data, ctx);
  } catch (error) {
    return {
      isError: true,
      summary: `${name} failed unexpectedly`,
      data: {
        error: "tool_exception",
        message: error instanceof Error ? error.message : String(error),
        hint: "Apologise, and offer to escalate to a human agent if this persists.",
      },
    };
  }
}
