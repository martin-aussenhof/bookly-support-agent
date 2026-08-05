import { z } from "zod";

import { defineTool } from "./types";

const schema = z.object({
  reason: z
    .enum([
      "customer_requested",
      "policy_exception",
      "outside_scope",
      "repeated_failure",
      "distressed_customer",
    ])
    .describe("Why the conversation needs a human."),
  summary: z
    .string()
    .describe(
      "A handover note for the human agent: what the customer wants, what you " +
        "already tried, and what is blocked. Written for a colleague, not the customer.",
    ),
});

/**
 * Escalation is a first-class tool rather than a failure mode. Making the agent
 * *do* something to escalate means the handover is structured and measurable —
 * you can chart escalation reasons and see exactly where the agent's ceiling is.
 */
export const escalateToHuman = defineTool({
  name: "escalate_to_human",
  description:
    "Hand the conversation to a human support agent with a written summary. " +
    "Call this when the customer asks for a person, when they want an exception " +
    "to policy that you cannot grant, when the request is outside what Bookly " +
    "support covers, or when you have failed twice to make progress. Escalating " +
    "early is much better than guessing.",
  mutating: true,
  schema,
  async execute({ reason, summary }, ctx) {
    ctx.remember({ escalated: true });

    const ticketId = `ESC-${Math.floor(10000 + Math.random() * 89999)}`;
    return {
      summary: `Escalated to a human (${reason.replace(/_/g, " ")}) — ${ticketId}`,
      data: {
        ticketId,
        reason,
        handoverNote: summary,
        queuePosition: 2,
        expectedWaitMinutes: 6,
        nextSteps:
          "Tell the customer a human has the full context and the expected wait. " +
          "Do not promise any outcome on the human's behalf.",
      },
    };
  },
});
