import type { HelpArticle } from "../types";

/**
 * The Bookly help centre. In production this would be a vector index; here a
 * small keyword-scored corpus keeps the retrieval step honest without adding an
 * embedding dependency. The agent is only ever allowed to answer policy
 * questions from these bodies (see the system prompt's grounding rule).
 */
export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "kb-returns-window",
    title: "Return window and eligibility",
    keywords: ["return", "returns", "refund", "send back", "window", "eligible", "30 days"],
    body:
      "Books may be returned within 30 days of delivery for a full refund. " +
      "Items must be in resalable condition. Signed and personalised editions, " +
      "clearance items, and digital downloads are final sale and cannot be returned. " +
      "Return shipping is free for defective or incorrectly shipped items; otherwise a " +
      "£2.99 return-label fee is deducted from the refund.",
  },
  {
    id: "kb-refund-timing",
    title: "When will I get my refund?",
    keywords: ["refund", "money back", "how long", "timing", "credit", "bank"],
    body:
      "Refunds are issued to the original payment method once the returned parcel is " +
      "scanned at our warehouse. Allow 3-5 business days for the refund to appear on " +
      "card statements, and up to 10 business days for bank transfers.",
  },
  {
    id: "kb-shipping-times",
    title: "Shipping options and delivery times",
    keywords: ["shipping", "delivery", "how long", "standard", "express", "dispatch", "arrive"],
    body:
      "Standard delivery arrives in 3-5 business days and is free on orders over £25. " +
      "Express delivery arrives in 1-2 business days for £4.99. Orders placed after " +
      "16:00 GMT are dispatched the next business day. We do not ship on weekends or " +
      "UK public holidays.",
  },
  {
    id: "kb-password-reset",
    title: "Resetting your password",
    keywords: ["password", "reset", "login", "log in", "sign in", "locked out", "account"],
    body:
      "Go to bookly.example/account/reset and enter the email address on the account. " +
      "The reset link is valid for 60 minutes. If the email does not arrive within 10 " +
      "minutes, check the spam folder. Support agents cannot set or read passwords; the " +
      "self-service link is the only way to change one.",
  },
  {
    id: "kb-missing-parcel",
    title: "My parcel says delivered but I do not have it",
    keywords: ["missing", "lost", "not received", "delivered", "stolen", "parcel", "package"],
    body:
      "Carriers occasionally mark a parcel delivered up to 24 hours early. Check with " +
      "neighbours and any safe place noted on the tracking page. If the parcel has not " +
      "appeared 24 hours after the delivery scan, we will open a carrier investigation " +
      "and ship a replacement at no cost.",
  },
  {
    id: "kb-damaged-item",
    title: "Damaged, faulty, or wrong item received",
    keywords: ["damaged", "faulty", "broken", "torn", "wrong", "incorrect", "defective", "ripped"],
    body:
      "If a book arrives damaged or we sent the wrong title, start a return and " +
      "choose 'damaged' or 'wrong item' as the reason. Bookly pays the return " +
      "postage on these, so the full purchase price is refunded with no " +
      "£2.99 label fee deducted. Photographs are not required.",
  },
  {
    id: "kb-cancel-order",
    title: "Cancelling or changing an order",
    keywords: ["cancel", "change", "amend", "address", "modify", "stop"],
    body:
      "Orders can be cancelled or amended while their status is Processing. Once an " +
      "order is Shipped it cannot be changed; you may refuse delivery or start a return " +
      "after it arrives.",
  },
];
