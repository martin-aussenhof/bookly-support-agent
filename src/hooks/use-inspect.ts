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
 * `?inspect=1` sets it too, so a link can open straight into the reviewer's
 * view — which is how the recorded demos run.
 */

const STORAGE_KEY = "bookly:inspect";

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
  return localStorage.getItem(STORAGE_KEY) === "1";
}

/** Server render, and the first client render that must match it. */
function readOnServer(): boolean {
  return false;
}

function write(on: boolean) {
  localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  // `storage` only fires in *other* tabs, so this tab is told directly.
  for (const listener of listeners) listener();
}

export function useInspect(): readonly [boolean, () => void] {
  const inspect = useSyncExternalStore(subscribe, read, readOnServer);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("inspect");
    if (requested === "1" || requested === "0") write(requested === "1");
  }, []);

  const toggle = useCallback(() => write(!read()), []);

  return [inspect, toggle] as const;
}
