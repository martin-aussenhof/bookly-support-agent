/**
 * Human-readable mirrors of the raw fields in a tool result.
 *
 * The model is handed `JSON.stringify(result.data)`, so every value in there is
 * something it may repeat verbatim — and it does. Left with `totalCents: 5747`
 * it has to do arithmetic in front of the customer to reach "£57.47", and left
 * with `status: "out_for_delivery"` it tends to paste the field value, snake
 * case and all.
 *
 * So the backend states each of those a second time, already formatted. The
 * raw fields stay: they are the machine-readable truth, and the demo assertions
 * read them. These are the strings the reply should quote.
 */

/** Pence to the string the customer should see. */
export function gbp(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

/** `out_for_delivery` → `out for delivery`. */
export function plainStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/**
 * ISO date to something speakable. Fixed to en-GB rather than the server's
 * locale so a deployment region cannot quietly change what customers read.
 */
export function plainDate(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
