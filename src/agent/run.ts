import "server-only";

import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "together-ai/resources/chat/completions";

import { estimateTokens, estimateTokensFromJson } from "@/server/usage/estimate";
import { calculateCostUsd } from "@/server/usage/pricing";
import { getTotals, recordUsage } from "@/server/usage/store";
import { AGENT_CONFIG } from "./config";
import type { AgentEvent } from "./events";
import { loadSession, saveSession } from "./memory/session-store";
import { buildSystemPrompt } from "./prompts/system";
import { executeTool, getTool, toFunctionTools } from "./tools/registry";
import type { ToolContext } from "./tools/types";
import { together } from "./together";
import { appendUserMessage, applyAgentEvent } from "./transcript";
import { VisibleTextFilter } from "./visible-text";

/** A tool call reassembled from streaming deltas. */
interface PendingToolCall {
  id: string;
  name: string;
  /** Accumulated JSON string; parsed by the registry. */
  arguments: string;
}

/**
 * The orchestration loop.
 *
 * One user message in, a stream of `AgentEvent`s out. Everything the agent does
 * — streaming text, calling tools, deciding it is finished, accounting for what
 * it spent — happens here, in a loop we own, rather than inside a framework.
 * That is deliberate: the loop is where guardrails, budgets, and observability
 * naturally live, so it should be the most readable file in the project.
 */
export async function* runAgent(
  sessionId: string,
  userMessage: string,
): AsyncGenerator<AgentEvent> {
  const session = await loadSession(sessionId);
  const tools = toFunctionTools() as ChatCompletionTool[];

  session.messages.push({ role: "user", content: userMessage });
  session.transcript = appendUserMessage(session.transcript, userMessage);

  /**
   * Every event is mirrored into the persisted transcript on its way out, so
   * what gets stored is exactly what the browser rendered. Yielding through
   * one place also means no event can be persisted-but-not-sent, or vice versa.
   */
  const emit = (event: AgentEvent): AgentEvent => {
    session.transcript = applyAgentEvent(session.transcript, event);
    return event;
  };

  /**
   * Shared by every tool call in the turn. `facts` is a getter rather than a
   * snapshot so a tool that runs after another's `remember()` sees the update.
   */
  const toolContext: ToolContext = {
    sessionId,
    get facts() {
      return session.facts;
    },
    remember: (patch) => {
      session.facts = { ...session.facts, ...patch };
    },
  };

  /** Tool names attempted this turn, for the handover note if we run out of budget. */
  const toolsAttempted: string[] = [];

  let iterations = 0;
  let turnPromptTokens = 0;
  let turnCompletionTokens = 0;
  let turnCostUsd = 0;
  let turnEstimated = false;
  let finishReason: string | null = null;

  try {
    while (iterations < AGENT_CONFIG.maxIterations) {
      iterations += 1;

      session.messages = trimHistory(session.messages, AGENT_CONFIG.maxHistoryMessages);

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt(session.facts) },
        ...session.messages,
      ];

      const stream = await together().chat.completions.create({
        model: AGENT_CONFIG.model,
        messages,
        tools,
        temperature: AGENT_CONFIG.temperature,
        max_tokens: AGENT_CONFIG.maxTokens,
        stream: true,
      });

      yield emit({ type: "message_start" });

      let text = "";
      // Keeps the model's private reasoning channel out of the customer's view
      // and out of the stored transcript.
      const visible = new VisibleTextFilter();
      const toolCalls: PendingToolCall[] = [];
      let reportedPromptTokens: number | null = null;
      let reportedCompletionTokens: number | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];

        if (choice?.finish_reason) finishReason = choice.finish_reason;

        const content = choice?.delta?.content;
        if (content) {
          const shown = visible.push(content);
          if (shown) {
            text += shown;
            yield emit({ type: "text_delta", text: shown });
          }
        }

        // Tool calls stream in fragments keyed by index: the name arrives once,
        // the JSON arguments arrive a few characters at a time.
        for (const delta of choice?.delta?.tool_calls ?? []) {
          const index = delta.index ?? 0;
          toolCalls[index] ??= { id: "", name: "", arguments: "" };
          if (delta.id) toolCalls[index].id = delta.id;
          if (delta.function?.name) toolCalls[index].name += delta.function.name;
          if (delta.function?.arguments) {
            toolCalls[index].arguments += delta.function.arguments;
          }
        }

        if (chunk.usage) {
          reportedPromptTokens = chunk.usage.prompt_tokens ?? null;
          reportedCompletionTokens = chunk.usage.completion_tokens ?? null;
        }
      }

      const tail = visible.flush();
      if (tail) {
        text += tail;
        yield emit({ type: "text_delta", text: tail });
      }

      const calls = toolCalls.filter(Boolean);

      // --- cost accounting for this model call -------------------------------
      const estimated = reportedPromptTokens === null || reportedCompletionTokens === null;
      const promptTokens =
        reportedPromptTokens ?? estimateTokensFromJson({ messages, tools });
      const completionTokens =
        reportedCompletionTokens ??
        estimateTokens(text + calls.map((c) => c.name + c.arguments).join(""));
      const costUsd = calculateCostUsd(AGENT_CONFIG.model, promptTokens, completionTokens);

      turnPromptTokens += promptTokens;
      turnCompletionTokens += completionTokens;
      turnCostUsd += costUsd;
      turnEstimated ||= estimated;

      await recordUsage({
        sessionId,
        model: AGENT_CONFIG.model,
        promptTokens,
        completionTokens,
        costUsd,
        estimated,
      });

      session.messages.push({
        role: "assistant",
        content: text,
        ...(calls.length > 0 && {
          // Together's assistant-message type requires the positional `index`
          // alongside the id, unlike the plain OpenAI shape.
          tool_calls: calls.map((call, index) => ({
            index,
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
      });

      if (calls.length === 0) break;

      // Announce every call before running anything, so the UI can show what
      // the agent is doing while it happens.
      for (const call of calls) {
        yield emit({
          type: "tool_call",
          id: call.id,
          name: call.name,
          input: safeParse(call.arguments),
          mutating: getTool(call.name)?.mutating ?? false,
        });
      }

      // Parallel tool calls arrive in one assistant message; run them together
      // and append every result before the next model call.
      toolsAttempted.push(...calls.map((call) => call.name));

      const executions = await Promise.all(
        calls.map(async (call) => ({
          call,
          result: await executeTool(call.name, call.arguments, toolContext),
        })),
      );

      for (const { call, result } of executions) {
        yield emit({
          type: "tool_result",
          id: call.id,
          name: call.name,
          summary: result.summary,
          isError: result.isError ?? false,
          data: result.data,
        });

        session.messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    const totals = await getTotals();
    yield emit({
      type: "usage",
      model: AGENT_CONFIG.model,
      promptTokens: turnPromptTokens,
      completionTokens: turnCompletionTokens,
      turnCostUsd,
      totalCostUsd: totals.totalCostUsd,
      estimated: turnEstimated,
    });

    if (iterations >= AGENT_CONFIG.maxIterations && finishReason === "tool_calls") {
      // Budget exhausted mid-task. This is the one case where the agent has
      // demonstrably failed, so it must not dead-end: escalate for real, with a
      // note, instead of telling the customer a human "should" take over and
      // then doing nothing about it.
      console.warn("[agent] step budget exhausted", {
        sessionId,
        iterations,
        toolsAttempted,
      });
      yield* handOver(emit, toolContext, {
        summary:
          `The agent reached its ${AGENT_CONFIG.maxIterations}-step limit without finishing. ` +
          `The customer asked: "${userMessage}". ` +
          (toolsAttempted.length > 0
            ? `Tools already tried: ${[...new Set(toolsAttempted)].join(", ")}. `
            : "No tools completed. ") +
          "Please take over from the transcript.",
      });

      const message =
        "I wasn't able to finish this one myself, so I've passed it to a colleague " +
        "along with everything I've tried. They'll pick it up from here.";
      // Keep the model's own history consistent with what the customer was told.
      session.messages.push({ role: "assistant", content: message });
      yield emit({ type: "notice", message });
      return;
    }

    yield emit({ type: "done", finishReason, iterations });
  } catch (error) {
    // The customer gets a plain apology; the provider's wording — auth failures,
    // rate-limit text, socket errors — stays in the logs where it belongs.
    console.error("[agent] turn failed", { sessionId, iterations, error });
    yield emit({
      type: "error",
      message:
        "Something went wrong on our side and I couldn't finish that reply. " +
        "Please try again — if it keeps happening, ask for a human and I'll hand you over.",
      ...(process.env.NODE_ENV !== "production" && {
        detail: error instanceof Error ? error.message : String(error),
      }),
    });
  } finally {
    // Runs on every exit path — normal completion, error, and the `.return()`
    // the SSE stream issues when the client disconnects — so a customer who
    // closes the tab mid-answer still finds the conversation where they left it.
    await saveSession(session);
  }
}

/**
 * Escalates on the agent's behalf, emitting the same `tool_call` /`tool_result`
 * pair a model-initiated escalation would. The handover therefore appears in
 * the transcript as an ordinary tool card, and lands in the same place — with
 * the same reason code — as one the model asked for, so escalation counts stay
 * honest whether the agent chose to hand over or was forced to.
 */
async function* handOver(
  emit: (event: AgentEvent) => AgentEvent,
  ctx: ToolContext,
  input: { summary: string },
): AsyncGenerator<AgentEvent> {
  const id = `auto_${crypto.randomUUID().slice(0, 8)}`;
  const args = { reason: "repeated_failure" as const, summary: input.summary };

  yield emit({
    type: "tool_call",
    id,
    name: "escalate_to_human",
    input: args,
    mutating: true,
  });

  const result = await executeTool("escalate_to_human", JSON.stringify(args), ctx);

  yield emit({
    type: "tool_result",
    id,
    name: "escalate_to_human",
    summary: result.summary,
    isError: result.isError ?? false,
    data: result.data,
  });
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

/**
 * Keeps the transcript bounded without orphaning a `tool` message from the
 * assistant `tool_calls` it answers — the API rejects a history whose first
 * message replies to a tool call that is no longer present.
 */
function trimHistory(
  messages: ChatCompletionMessageParam[],
  limit: number,
): ChatCompletionMessageParam[] {
  if (messages.length <= limit) return messages;

  let start = messages.length - limit;
  while (start < messages.length && messages[start].role !== "user") {
    start += 1;
  }
  return start >= messages.length ? messages.slice(-1) : messages.slice(start);
}
