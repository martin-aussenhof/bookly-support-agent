/**
 * Strips a model's reasoning channel out of the streamed text.
 *
 * GPT-OSS models emit the "harmony" format, and Together does not hand that
 * structure back as data — it drops the `<|...|>` control tokens and leaves the
 * channel *names* glued to the prose. What actually arrives in `delta.content`
 * looks like:
 *
 *   analysisThe customer wants a refund.assistantfinalHappy to help — …
 *
 * Without this filter the customer reads the model thinking out loud, and the
 * channel names surface as the first word of a reply ("finalI'm not able to
 * confirm…"), which is the tell that gives the whole illusion away.
 *
 * An earlier version only understood one shape: a response opening with
 * `analysis` and closing with `assistantfinal`. Later iterations in the same
 * turn — the model calls after a tool result — routinely open on a different
 * channel, and those fell through as ordinary prose, markers and all. So this
 * matches markers wherever they legitimately appear rather than assuming the
 * response opens with one.
 *
 * Two rules keep it from eating real words:
 *
 *   1. A channel name only counts as a marker when it runs *straight into* its
 *      content. A reply that genuinely opens "analysis of your order shows…"
 *      has a space after the word, and survives untouched.
 *   2. Mid-reply, a marker only counts on a segment boundary — directly after
 *      sentence-ending punctuation or a newline. That is what stops "your
 *      final refund" from quietly losing a word.
 *
 * It runs *during* streaming, so it cannot buffer the response and split it.
 * Instead it holds back a few characters — just longer than the longest marker
 * — so a marker split across two deltas is still caught before either half
 * reaches the customer.
 */

/** Channels whose content is private thinking. */
const REASONING_TAGS = [
  "assistantanalysis",
  "assistantcommentary",
  "analysis",
  "commentary",
] as const;

/**
 * Channels that carry the reply. Only an explicit final channel ends a private
 * section — a bare `assistant` is too weak a signal, because harmony emits it
 * *between* thoughts as well as before the answer.
 */
const FINAL_TAGS = ["assistantfinal", "final"] as const;

/** Structural, but says nothing about which channel comes next. Always dropped. */
const BARE_TAGS = ["assistant"] as const;

const byLengthDesc = (a: string, b: string) => b.length - a.length;

/** Longest first, so `assistantfinal` is never mistaken for a bare `assistant`. */
const ALL_TAGS: string[] = [...REASONING_TAGS, ...FINAL_TAGS, ...BARE_TAGS].sort(byLengthDesc);
const CLOSING_TAGS: string[] = [...FINAL_TAGS].sort(byLengthDesc);

const REASONING = new Set<string>(REASONING_TAGS);

/** Enough to hold the longest marker plus the character that proves it is one. */
const HOLD_BACK = Math.max(...ALL_TAGS.map((tag) => tag.length)) + 1;

/** Only these can precede a mid-reply marker. */
const BOUNDARY = /[.!?\n]/;

type Mode = "detecting" | "reasoning" | "visible";

export class VisibleTextFilter {
  private mode: Mode = "detecting";
  private buffer = "";
  /** Last character actually emitted, so a boundary spanning two deltas still reads as one. */
  private lastEmitted = "";

  /** Feeds one delta in; returns the portion (possibly empty) safe to show. */
  push(delta: string): string {
    this.buffer += delta;
    return this.drain(false);
  }

  /**
   * Call once the stream ends. Releases whatever is still held back, except a
   * response that never left a private channel — that had no reply in it at
   * all, because the model went straight to a tool call.
   */
  flush(): string {
    if (this.mode === "detecting") this.mode = "visible";

    if (this.mode === "reasoning") {
      this.buffer = "";
      return "";
    }
    return this.drain(true);
  }

  private drain(atEnd: boolean): string {
    for (;;) {
      if (this.mode === "detecting") {
        // Wait until there is enough to tell a marker from ordinary prose.
        if (!atEnd && this.buffer.length <= HOLD_BACK) return "";

        const tag = this.tagAt(0);
        if (tag) {
          this.buffer = this.buffer.slice(tag.length);
          this.mode = REASONING.has(tag) ? "reasoning" : "visible";
        } else {
          this.mode = "visible";
        }
        continue;
      }

      if (this.mode === "reasoning") {
        const end = this.findClosingTag();
        if (end === null) {
          // Drop the private text, but keep a tail in case a marker is split
          // across this delta and the next.
          if (this.buffer.length > HOLD_BACK) this.buffer = this.buffer.slice(-HOLD_BACK);
          return "";
        }
        this.buffer = this.buffer.slice(end);
        this.mode = "visible";
        continue;
      }

      return this.drainVisible(atEnd);
    }
  }

  /** Emits reply text, dropping any channel marker sitting on a boundary. */
  private drainVisible(atEnd: boolean): string {
    // While streaming, stop short of the end: the tail may be half a marker.
    const limit = atEnd ? this.buffer.length : this.buffer.length - HOLD_BACK;
    if (limit <= 0) return "";

    let out = "";
    let index = 0;

    while (index < limit) {
      const previous = index > 0 ? this.buffer[index - 1] : this.lastEmitted;
      const tag = previous && BOUNDARY.test(previous) ? this.tagAt(index) : null;

      if (tag) {
        index += tag.length;
        continue;
      }
      out += this.buffer[index];
      index += 1;
    }

    this.buffer = this.buffer.slice(index);
    if (out) this.lastEmitted = out[out.length - 1];
    return out;
  }

  /** The marker starting exactly at `index`, if one does. */
  private tagAt(index: number): string | null {
    for (const tag of ALL_TAGS) {
      if (!this.buffer.startsWith(tag, index)) continue;

      const next = this.buffer[index + tag.length];
      // A marker runs straight into its content. The word standing on its own
      // — "final answer", "analysis of your order" — has whitespace after it.
      // `undefined` means the proof has not arrived yet, so decline for now.
      if (next === undefined || /\s/.test(next)) continue;

      return tag;
    }
    return null;
  }

  /** Index just past the first final-channel marker, or null if none has arrived. */
  private findClosingTag(): number | null {
    for (let index = 0; index < this.buffer.length; index += 1) {
      for (const tag of CLOSING_TAGS) {
        if (!this.buffer.startsWith(tag, index)) continue;

        const next = this.buffer[index + tag.length];
        if (next === undefined || /\s/.test(next)) continue;

        return index + tag.length;
      }
    }
    return null;
  }
}
