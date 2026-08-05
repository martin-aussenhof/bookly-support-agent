import { cookies } from "next/headers";
import { z } from "zod";

import { deleteSession, sweepExpiredSessions } from "@/agent/memory/session-store";
import { runAgent } from "@/agent/run";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";
import { SSE_HEADERS, toSSEStream } from "@/lib/sse";

/** The agent loop is stateful and long-lived; keep it off the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
});

/**
 * The session id comes from the httpOnly cookie, never the request body — the
 * browser cannot ask to read or append to a conversation that is not its own.
 */
export async function POST(request: Request) {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return Response.json({ error: "no_session" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  return new Response(toSSEStream(runAgent(sessionId, parsed.data.message)), {
    headers: SSE_HEADERS,
  });
}

/**
 * "New chat": drop the stored conversation and rotate to a fresh id, so the old
 * transcript is unreachable rather than merely hidden.
 */
export async function DELETE() {
  const store = await cookies();
  const current = store.get(SESSION_COOKIE)?.value;
  if (current) await deleteSession(current);

  store.set(SESSION_COOKIE, crypto.randomUUID(), sessionCookieOptions);

  // Opportunistic retention sweep — no scheduler needed for the demo.
  void sweepExpiredSessions();

  return new Response(null, { status: 204 });
}
