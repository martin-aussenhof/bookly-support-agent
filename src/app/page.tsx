import { ChatPanel } from "@/components/chat/chat-panel";
import { getUsageSnapshot } from "@/server/usage/snapshot";

/** The cost meter reads live totals, so this page is rendered per request. */
export const dynamic = "force-dynamic";

export default async function Home() {
  // Server-rendered so the meter has a real number on first paint instead of a
  // skeleton and a fetch waterfall.
  const initialUsage = await getUsageSnapshot();

  return <ChatPanel initialUsage={initialUsage} />;
}
