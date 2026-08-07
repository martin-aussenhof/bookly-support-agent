"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Whether to show the machinery behind the conversation.
 *
 * Off is the honest default: a customer has no business reading a tool name or
 * a JSON payload, and none of it is written for them. On turns the transcript
 * into the reviewer's view — the tool called, its arguments, what came back,
 * and what the turn cost.
 *
 * The preference lives in localStorage rather than React state because it
 * outlives the page, and it is read through `useSyncExternalStore` so the
 * server and the first client render agree on the customer view before the
 * stored preference is applied. That puts the one frame of flicker on the
 * rarer, more deliberate mode, which is the right way round.
 *
 * `?inspect=1` opens a link straight into the reviewer's view, but only for
 * that page view — it deliberately does not write the preference. An earlier
 * version persisted it, so following the inspect link once left every later
 * visit showing tool names and JSON, and the only clue was a toggle nobody
 * remembered pressing. A URL is a way to look at something once; the toggle is
 * how you choose.
 */

const STORAGE_KEY = "bookly:inspect";

/** Set by `?inspect=`, and never written to storage. Outranks the preference. */
let override: boolean | null = null;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keeps two tabs of the same demo in step.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): boolean {
  if (override !== null) return override;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

/** Server render, and the first client render that must match it. */
function readOnServer(): boolean {
  return false;
}

function announce() {
  // `storage` only fires in *other* tabs, so this tab is told directly.
  for (const listener of listeners) listener();
}

export function useInspect(): readonly [boolean, () => void] {
  const inspect = useSyncExternalStore(subscribe, read, readOnServer);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("inspect");
    if (requested === "1" || requested === "0") {
      override = requested === "1";
      announce();
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !read();
    // Choosing beats being linked: a click settles it and the URL stops mattering.
    override = null;
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    announce();
  }, []);

  return [inspect, toggle] as const;
}
