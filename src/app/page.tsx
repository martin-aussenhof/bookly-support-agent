import { cookies } from "next/headers";

import { loadSession } from "@/agent/memory/session-store";
import { ChatPanel } from "@/components/chat/chat-panel";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { getUsageSnapshot } from "@/server/usage/snapshot";

/** Reads live totals and the visitor's stored conversation, so: per request. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;

  // Both server-rendered: the meter has a real number and the conversation is
  // already on the page at first paint, with no hydration fetch to wait for.
  const [initialUsage, session] = await Promise.all([
    getUsageSnapshot(),
    sessionId ? loadSession(sessionId) : null,
  ]);

  return <ChatPanel initialUsage={initialUsage} initialItems={session?.transcript ?? []} />;
}
