/**
 * Minimal Server-Sent Events helpers.
 *
 * SSE rather than a websocket: the agent stream is one-directional and
 * request-scoped, so it maps onto a plain HTTP response with no extra
 * infrastructure and survives every proxy in between.
 */

/** Wraps an async iterable of JSON-serialisable events in an SSE ReadableStream. */
export function toSSEStream<T>(source: AsyncIterable<T>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of source) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream failed.";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disables proxy buffering that would otherwise defeat streaming.
  "X-Accel-Buffering": "no",
} as const;

/**
 * Parses an SSE response body into individual `data:` payloads.
 * Handles chunk boundaries splitting a frame in half.
 */
export async function* readSSEStream<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (line) yield JSON.parse(line.slice(6)) as T;
    }
  }
}
