"use client";

import { Button } from "@/components/ui/button";

/**
 * Seeded prompts double as the demo script — each one exercises a different
 * path through the agent (multi-turn slot filling, grounded retrieval,
 * a write action, a policy refusal).
 */
const SUGGESTIONS = [
  "Where is my order?",
  "I want to return a book I bought",
  "How long do refunds take?",
  "My parcel says delivered but it isn't here",
];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="space-y-1.5">
        <h2 className="text-lg font-medium">How can I help?</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          I can check an order, start a return, or answer questions about shipping and policies.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((prompt) => (
          <Button key={prompt} variant="outline" size="sm" onClick={() => onPick(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
