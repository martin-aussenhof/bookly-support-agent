import { z } from "zod";

import { searchHelpCenter } from "@/server/bookly/client";
import { defineTool } from "./types";

const schema = z.object({
  query: z
    .string()
    .describe("The customer's question, in their own words or lightly rephrased."),
});

/**
 * Retrieval for every policy question. The system prompt forbids answering
 * policy from memory, so this tool is the only sanctioned source of truth for
 * shipping, refunds, password resets, and similar — which is what makes
 * "I don't know" a reachable answer.
 */
export const searchHelpCenterTool = defineTool({
  name: "search_help_center",
  description:
    "Search Bookly's help centre for policy and how-to answers: shipping times, " +
    "the return window, refund timing, password resets, missing parcels, order " +
    "changes. Call this before answering ANY policy question — never answer one " +
    "from memory. If it returns nothing relevant, say you do not know and offer " +
    "to escalate.",
  schema,
  async execute({ query }) {
    const articles = await searchHelpCenter(query);

    if (articles.length === 0) {
      return {
        summary: `No help-centre match for "${query}"`,
        data: {
          results: [],
          hint:
            "The help centre has nothing on this. Tell the customer you cannot " +
            "confirm the answer and offer to hand them to a human agent. Do not " +
            "invent a policy.",
        },
      };
    }

    return {
      summary: `${articles.length} article${articles.length > 1 ? "s" : ""} matched "${query}"`,
      data: {
        results: articles.map((a) => ({ id: a.id, title: a.title, body: a.body })),
        hint: "Answer using only these article bodies. Cite the article title.",
      },
    };
  },
});
