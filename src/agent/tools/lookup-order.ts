import { z } from "zod";

import { checkItemReturnable, getOrderForCustomer } from "@/server/bookly/client";
import { BooklyError } from "@/server/bookly/types";
import { gbp, plainDate, plainStatus } from "./format";
import { defineTool } from "./types";

const schema = z.object({
  orderId: z
    .string()
    .describe("The order number, e.g. BK-10432. Ask the customer if you do not have it."),
  email: z
    .string()
    .describe("The email address on the order. Required to authorise the lookup."),
});

/**
 * Read-only order lookup. Takes both an order id *and* an email because the
 * backend refuses to return an order to the wrong customer — the model cannot
 * skip the verification step by choosing different arguments.
 */
export const lookupOrder = defineTool({
  name: "lookup_order",
  description:
    "Retrieve the status, contents, and tracking details of a Bookly order. " +
    "Call this whenever the customer asks where their order is, what they " +
    "ordered, or before starting a return. Requires both the order number and " +
    "the email address on the account; if you are missing either, ask the " +
    "customer for it rather than guessing.",
  schema,
  async execute({ orderId, email }, ctx) {
    try {
      const order = await getOrderForCustomer(orderId, email);

      ctx.remember({
        verifiedEmail: email,
        knownOrderIds: [...new Set([...ctx.facts.knownOrderIds, order.id])],
      });

      return {
        summary: `Found order ${order.id} — ${plainStatus(order.status)}`,
        data: {
          id: order.id,
          status: order.status,
          statusText: plainStatus(order.status),
          placedAt: order.placedAt,
          placedOn: plainDate(order.placedAt),
          customerName: order.customerName,
          totalCents: order.totalCents,
          total: gbp(order.totalCents),
          // Each item says whether it can come back and, if not, why — decided
          // by the same function that will refuse the write. Without this the
          // model sees `finalSale: true`, has no way to know what Bookly does
          // about that, and cheerfully offers a return it cannot deliver.
          // Listed field by field rather than spread, so what the model can see
          // is a decision rather than whatever `OrderItem` happens to hold.
          //
          // `finalSale` is deliberately absent: `returnable` already carries
          // what it means, and the model wrote the raw flag into its reasoning,
          // where "finalSale" looks enough like harmony's `final` channel
          // marker to end a private section early and spill the rest.
          items: order.items.map((item) => {
            const allowed = checkItemReturnable(order, item.sku);
            return {
              sku: item.sku,
              title: item.title,
              author: item.author,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              unitPrice: gbp(item.unitPriceCents),
              returnable: allowed.returnable,
              ...(allowed.returnable ? {} : { notReturnableBecause: allowed.reason }),
            };
          }),
          shipment: order.shipment && {
            ...order.shipment,
            estimatedDeliveryOn: plainDate(order.shipment.estimatedDelivery),
            deliveredOn: plainDate(order.shipment.deliveredAt),
          },
        },
      };
    } catch (error) {
      if (error instanceof BooklyError) {
        return {
          isError: true,
          summary: `Lookup failed: ${error.code.replace(/_/g, " ")}`,
          data: {
            error: error.code,
            message: error.message,
            hint:
              error.code === "forbidden"
                ? "Do not reveal any order details. Ask the customer to confirm the email address they used at checkout."
                : "Ask the customer to double-check the order number from their confirmation email.",
          },
        };
      }
      throw error;
    }
  },
});
