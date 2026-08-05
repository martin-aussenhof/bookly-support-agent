/**
 * Domain types for the (fictional) Bookly commerce backend.
 *
 * These are deliberately kept free of any agent/LLM concepts: the agent layer
 * depends on this module, never the other way around.
 */

export type OrderStatus =
  | "processing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  sku: string;
  title: string;
  author: string;
  quantity: number;
  unitPriceCents: number;
  /**
   * Signed, personalised, and clearance stock is final sale — see the
   * "Return window and eligibility" help-centre article.
   */
  finalSale?: boolean;
}

/**
 * Why an item is coming back. Fault reasons waive the return-label fee, so
 * this is a priced field, not a free-text note — the customer's own wording
 * still travels alongside it as `reason`.
 */
export type ReturnReasonCode =
  | "damaged"
  | "wrong_item"
  | "not_as_described"
  | "changed_mind"
  | "other";

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  /** ISO date. Null once the parcel is delivered. */
  estimatedDelivery: string | null;
  /** ISO date. Null until the parcel is delivered. */
  deliveredAt: string | null;
}

export interface Order {
  id: string;
  email: string;
  customerName: string;
  placedAt: string;
  status: OrderStatus;
  items: OrderItem[];
  shipment: Shipment | null;
  totalCents: number;
}

export type ReturnStatus = "pending_label" | "label_sent" | "received" | "refunded";

export interface ReturnRequest {
  id: string;
  orderId: string;
  sku: string;
  reason: string;
  refundCents: number;
  status: ReturnStatus;
  createdAt: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  /** Keywords used by the (deliberately simple) lexical search. */
  keywords: string[];
  body: string;
}

/** Raised when the backend cannot satisfy a request. Tools translate these into tool errors. */
export class BooklyError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "forbidden" | "conflict",
  ) {
    super(message);
    this.name = "BooklyError";
  }
}
