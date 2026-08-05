/**
 * Minimal Server-Sent Events helpers.
 *
 * SSE rather than a websocket: the agent stream is one-directional and
 * request-scoped, so it maps onto a plain HTTP response with no extra
 * infrastructure and survives every proxy in between.
 */

/**
 * Wraps an async iterable of JSON-serialisable events in an SSE ReadableStream.
 *
 * Pulls one event at a time rather than draining the source in `start`, so the
 * stream respects backpressure and — more importantly — a client disconnect
 * reaches the source. `cancel` calls `.return()` on the iterator, which unwinds
 * the agent generator's `finally` blocks (persisting the partial turn) instead
 * of leaving it running against a socket nobody is reading.
 */
export function toSSEStream<T>(source: AsyncIterable<T>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = source[Symbol.asyncIterator]();
  let closed = false;

  const frame = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(frame(value));
      } catch (error) {
        // Never enqueue onto a controller the consumer already tore down —
        // that throws a second time and surfaces a routine disconnect as an
        // unhandled rejection.
        if (closed) return;
        closed = true;
        const message = error instanceof Error ? error.message : "Stream failed.";
        controller.enqueue(frame({ type: "error", message }));
        controller.close();
      }
    },

    async cancel() {
      closed = true;
      await iterator.return?.(undefined);
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
