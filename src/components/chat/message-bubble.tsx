import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types/chat";

export function MessageBubble({ message }: { message: MessageItem }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.text}
        {message.streaming && (
          <span className="bg-foreground/60 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}
