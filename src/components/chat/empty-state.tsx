"use client";

import { ArrowUpRight, PackageSearch, RotateCcw, ShieldQuestion, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Seeded prompts double as the demo script — each one exercises a different
 * path through the agent (multi-turn slot filling, a write action, grounded
 * retrieval, and a case with no help-centre answer).
 */
const SUGGESTIONS: { icon: LucideIcon; label: string; hint: string; prompt: string }[] = [
  {
    icon: PackageSearch,
    label: "Where is my order?",
    hint: "Needs an order number and email first",
    prompt: "Where is my order?",
  },
  {
    icon: RotateCcw,
    label: "Return a book",
    hint: "Checks the 30-day window before acting",
    prompt: "I want to return a book I bought",
  },
  {
    icon: Truck,
    label: "How long do refunds take?",
    hint: "Answered from the help centre only",
    prompt: "How long do refunds take?",
  },
  {
    icon: ShieldQuestion,
    label: "My parcel is missing",
    hint: "Marked delivered but never arrived",
    prompt: "My parcel says delivered but it isn't here",
  },
];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <h2 className="text-3xl font-semibold text-balance sm:text-4xl">How can I help?</h2>
      <p className="text-muted-foreground mt-3 max-w-md text-sm text-pretty sm:text-[0.9375rem]">
        I can check an order, start a return, or answer questions about shipping and policies.
        I&rsquo;ll ask before I do anything that costs you money.
      </p>

      <div className="mt-8 grid w-full gap-2.5 sm:mt-10 sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, label, hint, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(prompt)}
            className="group bg-card/60 hover:border-primary/35 hover:bg-card focus-visible:ring-ring/60 flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-accent text-accent-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-3.5" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium">
                {label}
                <ArrowUpRight className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                {hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
