"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SLIDES } from "./slides";

/**
 * The pitch deck, as a route.
 *
 * A deck rather than a PDF because it can then reuse the product's own type and
 * colour, stay in version control next to the thing it describes, and never
 * drift from it. Arrow keys, space, and the dots all navigate; it prints to
 * five pages.
 */
export function Deck() {
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(event.key)) {
        event.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Home") setIndex(0);
      else if (event.key === "End") setIndex(last);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, last]);

  const slide = SLIDES[index];

  return (
    <div className="app-ambient flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <span className="font-display text-lg tracking-tight">Bookly</span>
        <span className="text-muted-foreground text-2xs font-medium tracking-widest uppercase">
          Solutions Engineering
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">
            {index + 1} / {SLIDES.length}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center px-4 py-6 sm:px-8">
        <article key={index} className="measure animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-primary text-2xs font-semibold tracking-widest uppercase">
            {slide.kicker}
          </p>
          <h1 className="font-display mt-3 text-3xl leading-[1.1] tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {slide.title}
          </h1>
          <div className="mt-8">{slide.body}</div>
        </article>
      </main>

      <footer className="flex items-center gap-3 px-4 py-4 sm:px-8">
        <div className="flex gap-1.5" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.kicker}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.kicker}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "bg-primary w-8" : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-4",
              )}
            />
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Previous slide"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            onClick={() => go(1)}
            disabled={index === last}
            aria-label="Next slide"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
