"use client";

import { ArrowUp } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

/**
 * A floating composer rather than a full-width bar: it keeps the same measure
 * as the conversation, so on a wide display the input sits under the text it
 * belongs to instead of stretching edge to edge.
 */
export function Composer({ disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to a cap. Layout effect so the resize lands in the
  // same frame as the keystroke and the box never visibly jumps.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="from-background via-background/95 bg-linear-to-t to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form
        className="measure px-4 pt-2 sm:px-6 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="surface focus-within:border-primary/40 focus-within:ring-primary/15 flex items-end gap-2 p-2 transition-shadow focus-within:ring-4">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about an order, a return, or a policy…"
            rows={1}
            // The surface owns the border and focus ring, so the control inside
            // it must not draw its own.
            className="min-h-0 resize-none border-0 bg-transparent px-2 py-2 text-[0.9375rem] shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Message Bookly support"
          />

          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-lg transition-transform active:scale-95"
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>

        <p className="text-muted-foreground/60 mt-2 hidden text-center text-[11px] sm:block">
          <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-medium">Shift + Enter</kbd> for a new line
        </p>
      </form>
    </div>
  );
}
