import { z } from "zod";

import { checkReturnEligibility, createReturn, getOrderForCustomer } from "@/server/bookly/client";
import { BooklyError } from "@/server/bookly/types";
import { defineTool } from "./types";

const schema = z.object({
  orderId: z.string().describe("The order the item belongs to, e.g. BK-10432."),
  email: z.string().describe("The email address on the order."),
  sku: z
    .string()
    .describe(
      "The SKU of the single item being returned. Get this from lookup_order; " +
        "if the order has several items, ask the customer which one first.",
    ),
  reasonCode: z
    .enum(["damaged", "wrong_item", "not_as_described", "changed_mind", "other"])
    .describe(
      "Category for the return. This is priced: 'damaged' and 'wrong_item' are " +
        "Bookly's fault and waive the return-label fee. Pick the one that matches " +
        "what the customer actually said — do not guess 'damaged' to be generous.",
    ),
  reason: z
    .string()
    .describe("The customer's own words for why they are returning the item."),
});

/**
 * The one write action in the agent. Policy (the 30-day window, the label fee)
 * is evaluated in the backend, not in the prompt: the model asks for a return,
 * the system decides whether it is allowed.
 */
export const startReturn = defineTool({
  name: "start_return",
  description:
    "File a return and issue a prepaid label for ONE item on a delivered order. " +
    "Only call this after you have looked up the order, confirmed which item the " +
    "customer means, and captured their reason. Never call it speculatively — it " +
    "creates a real return the customer will be charged a label fee for.",
  mutating: true,
  schema,
  async execute({ orderId, email, sku, reason, reasonCode }, ctx) {
    try {
      const order = await getOrderForCustomer(orderId, email);
      const eligibility = checkReturnEligibility(order, sku, reasonCode);

      if (!eligibility.eligible) {
        const knownSku = order.items.some((item) => item.sku === sku);
        return {
          isError: true,
          summary: `Return refused — ${eligibility.reason}`,
          data: {
            error: knownSku ? "not_eligible" : "unknown_sku",
            message: eligibility.reason,
            // Always echo the real items back. Models occasionally invent a
            // plausible-looking SKU rather than copying the one from
            // lookup_order; without this the refusal is a dead end, and with it
            // the model can correct itself on the next step of the same turn.
            availableItems: order.items.map((item) => ({
              sku: item.sku,
              title: item.title,
              finalSale: item.finalSale ?? false,
            })),
            hint: knownSku
              ? "Explain the policy to the customer in plain language. If they are " +
                "unhappy with the outcome, offer to escalate to a human agent."
              : "That SKU is not on this order. Retry with one of availableItems, " +
                "copied exactly — never construct a SKU yourself.",
          },
        };
      }

      const request = await createReturn({ order, sku, reason, reasonCode });
      ctx.remember({
        verifiedEmail: email,
        createdReturnIds: [...ctx.facts.createdReturnIds, request.id],
      });

      return {
        summary: `Return ${request.id} created — £${(request.refundCents / 100).toFixed(2)} refund`,
        data: {
          returnId: request.id,
          status: request.status,
          refundCents: request.refundCents,
          labelFeeCents: eligibility.feeCents,
          labelFeeWaived: eligibility.feeCents === 0,
          nextSteps:
            "A prepaid label has been emailed to the customer. The refund is issued " +
            "once the parcel is scanned at the warehouse (3-5 business days after that). " +
            "Tell the customer the exact refund amount and whether the label fee applied.",
        },
      };
    } catch (error) {
      if (error instanceof BooklyError) {
        return {
          isError: true,
          summary: `Return failed: ${error.code.replace(/_/g, " ")}`,
          data: { error: error.code, message: error.message },
        };
      }
      throw error;
    }
  },
});
