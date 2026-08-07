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
 * The hard part is that every marker is also an ordinary English word. Three
 * rules keep real prose intact:
 *
 *   1. A marker runs *straight into* its content. "analysis of your order" has
 *      a space after the word and is left alone.
 *   2. Mid-stream, a marker sits on a boundary — after punctuation or a symbol,
 *      never after a letter, digit or space. That is what saves "your final
 *      refund" and "£12.99final".
 *   3. The single-word markers are held to a stricter standard than the
 *      compound ones, because `assistantfinal` collides with nothing while
 *      `final` is a word, a prefix, and a JSON field name. See AMBIGUOUS below.
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
const CLOSING_TAGS_SRC = ["assistantfinal", "final"] as const;

/** Structural, but says nothing about which channel comes next. Always dropped. */
const BARE_TAGS = ["assistant"] as const;

/**
 * Markers that are also everyday words, so they need a sentence boundary before
 * them and a non-lowercase character after.
 *
 * `.finally we can answer` and `(finalSale true, returnable false)` both looked
 * like the end of a private channel to an earlier version of this, and the
 * reasoning after them — field names included — went to the customer. The
 * compound markers are exempt: nothing in English is `assistantfinal`, so a
 * reply that genuinely begins in lower case still survives one.
 */
const AMBIGUOUS: ReadonlySet<string> = new Set(["final", "analysis", "commentary", "assistant"]);

const byLengthDesc = (a: string, b: string) => b.length - a.length;

/** Longest first, so `assistantfinal` is never mistaken for a bare `assistant`. */
const ALL_TAGS: string[] = [...REASONING_TAGS, ...CLOSING_TAGS_SRC, ...BARE_TAGS].sort(
  byLengthDesc,
);
const CLOSING_TAGS: string[] = [...CLOSING_TAGS_SRC].sort(byLengthDesc);

const REASONING = new Set<string>(REASONING_TAGS);

/** Enough to hold the longest marker plus the character that proves it is one. */
const HOLD_BACK = Math.max(...ALL_TAGS.map((tag) => tag.length)) + 1;

/** May precede a marker: punctuation or a symbol, never a letter, digit or space. */
const BOUNDARY = /[^\p{L}\p{N}\s]/u;

/** The tighter boundary, required before a marker that is also a word. */
const SENTENCE_END = /[.!?\n]/;

const LOWERCASE = /\p{Ll}/u;

type Mode = "detecting" | "reasoning" | "visible";

export class VisibleTextFilter {
  private mode: Mode = "detecting";
  private buffer = "";
  /**
   * The character immediately before `buffer[0]` in the original stream, so a
   * boundary still reads correctly after the buffer has been sliced or the
   * discarded reasoning trimmed. Empty only at the very start of the stream.
   */
  private previousChar = "";

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

  /** Drops `count` characters, keeping the boundary context they carried. */
  private consume(count: number) {
    if (count <= 0) return;
    this.previousChar = this.buffer[count - 1] ?? this.previousChar;
    this.buffer = this.buffer.slice(count);
  }

  private drain(atEnd: boolean): string {
    let out = "";

    for (;;) {
      if (this.mode === "detecting") {
        // Wait until there is enough to tell a marker from ordinary prose.
        if (!atEnd && this.buffer.length <= HOLD_BACK) return out;

        const tag = this.tagAt(0);
        if (tag) {
          this.consume(tag.length);
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
          if (this.buffer.length > HOLD_BACK) this.consume(this.buffer.length - HOLD_BACK);
          return out;
        }
        this.consume(end);
        this.mode = "visible";
        continue;
      }

      const drained = this.drainVisible(atEnd);
      out += drained.text;
      // A reasoning channel opened mid-reply: go round again and suppress it.
      if (!drained.reopenedPrivate) return out;
    }
  }

  /**
   * Emits reply text up to the next channel marker.
   *
   * A marker is a transition, not litter. Stripping a reasoning tag and
   * carrying on would leave the thinking that follows it on screen, which is
   * exactly what the filter exists to prevent — so hitting one hands control
   * back to the reasoning branch.
   */
  private drainVisible(atEnd: boolean): { text: string; reopenedPrivate: boolean } {
    // While streaming, stop short of the end: the tail may be half a marker.
    const limit = atEnd ? this.buffer.length : this.buffer.length - HOLD_BACK;
    if (limit <= 0) return { text: "", reopenedPrivate: false };

    let index = 0;
    while (index < limit) {
      const tag = this.tagAt(index);
      if (tag) {
        const text = this.buffer.slice(0, index);
        this.consume(index + tag.length);

        if (REASONING.has(tag)) {
          this.mode = "reasoning";
          return { text, reopenedPrivate: true };
        }
        // A final or bare marker: drop it and keep reading the reply after it.
        const rest = this.drainVisible(atEnd);
        return { text: text + rest.text, reopenedPrivate: rest.reopenedPrivate };
      }
      index += 1;
    }

    const text = this.buffer.slice(0, limit);
    this.consume(limit);
    return { text, reopenedPrivate: false };
  }

  /** The marker starting exactly at `index`, if one does. */
  private tagAt(index: number): string | null {
    for (const tag of ALL_TAGS) {
      if (this.matches(tag, index)) return tag;
    }
    return null;
  }

  /** Index just past the first final-channel marker, or null if none has arrived. */
  private findClosingTag(): number | null {
    for (let index = 0; index < this.buffer.length; index += 1) {
      for (const tag of CLOSING_TAGS) {
        if (this.matches(tag, index)) return index + tag.length;
      }
    }
    return null;
  }

  /** Whether `tag` really is a channel marker at `index`, rather than a word. */
  private matches(tag: string, index: number): boolean {
    if (!this.buffer.startsWith(tag, index)) return false;

    const next = this.buffer[index + tag.length];
    // A marker runs straight into its content. The word standing on its own —
    // "final answer", "analysis of your order" — has whitespace after it.
    // `undefined` means the proof has not arrived yet, so decline for now.
    if (next === undefined || /\s/.test(next)) return false;

    const previous = index > 0 ? this.buffer[index - 1] : this.previousChar;
    const ambiguous = AMBIGUOUS.has(tag);

    // A word cannot continue past a marker: `finally`, `analysis`' own plural.
    if (ambiguous && LOWERCASE.test(next)) return false;

    // Nothing before it at all is the start of the stream, where the channel is
    // declared and any marker is legitimate.
    if (previous === "") return true;

    return (ambiguous ? SENTENCE_END : BOUNDARY).test(previous);
  }
}
