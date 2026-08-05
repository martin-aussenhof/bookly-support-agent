"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function Composer({ disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
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
        className="max-h-40 min-h-11 resize-none py-3"
        aria-label="Message Bookly support"
      />
      <Button
        type="submit"
        size="icon"
        className="size-11 shrink-0"
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
      >
        <ArrowUp className="size-4" />
      </Button>
    </form>
  );
}
