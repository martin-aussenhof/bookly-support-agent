import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types/chat";

/**
 * Renders the `**emphasis**` models reach for whatever the prompt says.
 *
 * The agent is told the chat renders nothing, and it still bolds order numbers
 * and delivery dates — that instinct is right, and fighting it with more prompt
 * text costs behaviour elsewhere. So the transcript honours the two markers
 * models actually use and drops the rest.
 *
 * Deliberately not a markdown library, and deliberately not HTML: this splits
 * the string and returns elements, so there is no parser to keep up with and no
 * path by which model output could become markup.
 */
const EMPHASIS = /(\*\*[^*\n]+\*\*|(?<![*\w])\*[^*\n]+\*(?!\w))/g;

function formatted(text: string): ReactNode[] {
  return text.split(EMPHASIS).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/**
 * Asymmetric by design.
 *
 * The customer's turn is a bubble — short, and it needs to read as *theirs*.
 * The agent's turn is plain prose on the page, because bubbles on both sides is
 * the stock-template look and it caps line length badly as the column widens.
 * Prose also lets the agent's answer sit naturally next to the tool cards that
 * produced it.
 */
export function MessageBubble({ message }: { message: MessageItem }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end pt-2">
        <div
          data-testid="message-user"
          className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[0.9375rem] leading-relaxed wrap-break-word shadow-sm sm:max-w-[78%]"
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span
        className="bg-primary/70 mt-2.5 hidden size-1.5 shrink-0 rounded-full sm:block"
        aria-hidden
      />
      <div
        data-testid="message-assistant"
        className={cn(
          "min-w-0 flex-1 text-[0.9375rem] leading-[1.7] whitespace-pre-wrap",
          "text-foreground/90",
        )}
      >
        {formatted(message.text)}
        {message.streaming && (
          <span
            className="bg-primary ml-1 inline-block h-4 w-0.75 translate-y-0.5 animate-pulse rounded-full"
            aria-label="Agent is typing"
          />
        )}
      </div>
    </div>
  );
}
