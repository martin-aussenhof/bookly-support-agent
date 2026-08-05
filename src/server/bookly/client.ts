import "server-only";

import { HELP_ARTICLES } from "./data/help-center";
import { ORDERS } from "./data/orders";
import {
  BooklyError,
  type HelpArticle,
  type Order,
  type ReturnRequest,
} from "./types";

/**
 * Mock Bookly commerce API.
 *
 * Every method has the shape a real HTTP client would have (async, throws typed
 * errors, adds latency) so that swapping this file for `fetch` calls against a
 * real backend does not touch the agent layer at all.
 */

const LATENCY_MS = 350;
const RETURN_WINDOW_DAYS = 30;
const RETURN_LABEL_FEE_CENTS = 299;

const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

/** Returns created during this process's lifetime. Swap for a DB in production. */
const RETURNS = new Map<string, ReturnRequest>();

const normalise = (value: string) => value.trim().toLowerCase();

export async function getOrder(orderId: string): Promise<Order> {
  await delay();
  const order = ORDERS.find((o) => normalise(o.id) === normalise(orderId));
  if (!order) {
    throw new BooklyError(`No order found with id ${orderId}.`, "not_found");
  }
  return order;
}

/**
 * Order lookup is gated on the email matching the order. This is the
 * authorisation boundary the agent must respect; it is enforced here rather
 * than in the prompt so the model cannot talk its way around it.
 */
export async function getOrderForCustomer(orderId: string, email: string): Promise<Order> {
  const order = await getOrder(orderId);
  if (normalise(order.email) !== normalise(email)) {
    throw new BooklyError(
      `Order ${order.id} is not associated with ${email}.`,
      "forbidden",
    );
  }
  return order;
}

export async function findOrdersByEmail(email: string): Promise<Order[]> {
  await delay();
  return ORDERS.filter((o) => normalise(o.email) === normalise(email));
}

export interface ReturnEligibility {
  eligible: boolean;
  reason: string;
  daysSinceDelivery: number | null;
  refundCents: number;
  feeCents: number;
}

export function checkReturnEligibility(order: Order, sku: string): ReturnEligibility {
  const item = order.items.find((i) => i.sku === sku);
  const base: ReturnEligibility = {
    eligible: false,
    reason: "",
    daysSinceDelivery: null,
    refundCents: 0,
    feeCents: 0,
  };

  if (!item) {
    return { ...base, reason: `Order ${order.id} does not contain SKU ${sku}.` };
  }
  if (!order.shipment?.deliveredAt) {
    return {
      ...base,
      reason: `Order ${order.id} has not been delivered yet, so it cannot be returned. It can still be cancelled while processing.`,
    };
  }

  const deliveredAt = new Date(order.shipment.deliveredAt);
  const daysSinceDelivery = Math.floor((Date.now() - deliveredAt.getTime()) / 86_400_000);

  if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
    return {
      ...base,
      daysSinceDelivery,
      reason: `Delivered ${daysSinceDelivery} days ago, outside the ${RETURN_WINDOW_DAYS}-day return window.`,
    };
  }

  const gross = item.unitPriceCents * item.quantity;
  return {
    eligible: true,
    reason: `Delivered ${daysSinceDelivery} days ago, inside the ${RETURN_WINDOW_DAYS}-day return window.`,
    daysSinceDelivery,
    refundCents: gross - RETURN_LABEL_FEE_CENTS,
    feeCents: RETURN_LABEL_FEE_CENTS,
  };
}

export async function createReturn(input: {
  order: Order;
  sku: string;
  reason: string;
}): Promise<ReturnRequest> {
  await delay();
  const eligibility = checkReturnEligibility(input.order, input.sku);
  if (!eligibility.eligible) {
    throw new BooklyError(eligibility.reason, "conflict");
  }

  const request: ReturnRequest = {
    id: `RET-${Math.floor(100000 + Math.random() * 899999)}`,
    orderId: input.order.id,
    sku: input.sku,
    reason: input.reason,
    refundCents: eligibility.refundCents,
    status: "label_sent",
    createdAt: new Date().toISOString(),
  };
  RETURNS.set(request.id, request);
  return request;
}

export interface ScoredArticle extends HelpArticle {
  score: number;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "your", "our", "was", "are",
  "can", "will", "how", "what", "when", "where", "why", "who", "did", "does", "have",
  "has", "had", "but", "not", "any", "all", "get", "got", "from", "about", "there",
  "they", "them", "its", "it's", "isn", "don", "doesn", "still", "just", "yet",
]);

/** Crude singularisation so "refunds" and "refund" are the same token. */
const stem = (token: string) =>
  token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;

const tokenise = (text: string) =>
  normalise(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map(stem);

/**
 * Deliberately simple lexical retrieval: score each article by exact token
 * overlap against its keywords and title.
 *
 * Exact token matching rather than substring matching matters more than it
 * looks: with substrings, "do you sell vinyl records" matches the password
 * article (because "you" appears inside "your"), and the agent then answers a
 * question it should have declined. A retrieval step that never returns nothing
 * cannot ground anything. Easy to replace with a vector search — the tool
 * contract does not change.
 */
export async function searchHelpCenter(query: string, limit = 3): Promise<ScoredArticle[]> {
  await delay(150);
  const terms = new Set(tokenise(query));
  if (terms.size === 0) return [];

  return HELP_ARTICLES.map((article) => {
    const haystack = new Set([
      ...article.keywords.flatMap(tokenise),
      ...tokenise(article.title),
    ]);
    let score = 0;
    for (const term of terms) if (haystack.has(term)) score += 1;
    return { ...article, score };
  })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
