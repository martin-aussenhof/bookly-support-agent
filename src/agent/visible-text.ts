/**
 * Strips a model's reasoning channel out of the streamed text.
 *
 * GPT-OSS models emit the "harmony" format, and Together returns it raw in
 * `delta.content`: the private analysis channel, then a literal
 * `assistantfinal` marker, then the reply. Without this filter the customer
 * reads the model thinking out loud — including things like "Need reason for
 * return and category. Ask customer for reason." — which is worse than a bug,
 * it looks like the agent talking to itself in front of them.
 *
 * The filter has to work *during* streaming, so it cannot simply buffer the
 * whole response and split it. Instead it sniffs the first few characters:
 * harmony output always opens with `analysis`, so anything else streams
 * through untouched from the first token and models that do not use channels
 * pay nothing for this.
 */

const OPENING = "analysis";
const FINAL_MARKER = "assistantfinal";

type Mode = "detecting" | "reasoning" | "visible";

export class VisibleTextFilter {
  private mode: Mode = "detecting";
  private buffer = "";

  /** Feeds one delta in; returns the portion (possibly empty) safe to show. */
  push(delta: string): string {
    if (this.mode === "visible") return delta;

    this.buffer += delta;

    if (this.mode === "detecting") {
      // One char past the marker, so we can tell the channel tag from prose.
      if (this.buffer.length <= OPENING.length) return "";

      // Harmony runs the tag straight into the reasoning (`analysisThe order…`).
      // A reply that merely opens with the word — "analysis of your order" —
      // has a space there, and must not be swallowed.
      const isChannelTag =
        this.buffer.startsWith(OPENING) && !/\s/.test(this.buffer[OPENING.length]);

      if (!isChannelTag) {
        this.mode = "visible";
        return this.take();
      }
      this.mode = "reasoning";
    }

    // Marker may be split across deltas, which is why we accumulate.
    const index = this.buffer.indexOf(FINAL_MARKER);
    if (index === -1) return "";

    this.mode = "visible";
    const visible = this.buffer.slice(index + FINAL_MARKER.length);
    this.buffer = "";
    return visible;
  }

  /**
   * Call once the stream ends. Releases a response too short to have been
   * classified; anything still held in reasoning mode never had a final
   * channel, which means there was no reply to show (the model went straight
   * to a tool call).
   */
  flush(): string {
    if (this.mode === "detecting") {
      this.mode = "visible";
      return this.take();
    }
    this.buffer = "";
    return "";
  }

  private take(): string {
    const value = this.buffer;
    this.buffer = "";
    return value;
  }
}
