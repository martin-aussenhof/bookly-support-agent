import { z } from "zod";

import { runAgent } from "@/agent/run";
import { resetSession } from "@/agent/memory/session-store";
import { SSE_HEADERS, toSSEStream } from "@/lib/sse";

/** The agent loop is stateful and long-lived; keep it off the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { sessionId, message } = parsed.data;
  return new Response(toSSEStream(runAgent(sessionId, message)), { headers: SSE_HEADERS });
}

/** Clears server-side conversation state so the demo can be restarted cleanly. */
export async function DELETE(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId) resetSession(sessionId);
  return new Response(null, { status: 204 });
}
