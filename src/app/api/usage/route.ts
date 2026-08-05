import { getUsageSnapshot } from "@/server/usage/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Global spend across every session. Polled by the meter; also pushed live on the chat stream. */
export async function GET() {
  return Response.json(await getUsageSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
