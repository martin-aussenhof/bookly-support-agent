import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types/chat";

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
        {message.text}
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
