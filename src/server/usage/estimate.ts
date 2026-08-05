/**
 * Fallback token estimation.
 *
 * Together's streaming schema marks `usage` as nullable and has no
 * `stream_options.include_usage`, so a stream can finish without reported token
 * counts. When that happens we estimate rather than record zero — an
 * under-reporting meter is worse than an approximate one — and flag the row as
 * estimated so the number is never mistaken for billing truth.
 *
 * ~4 characters per token is the usual rough ratio for English text on
 * BPE tokenizers. Do not use this for anything that needs to be exact.
 */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimates prompt size from whatever was serialised into the request. */
export function estimateTokensFromJson(value: unknown): number {
  try {
    return estimateTokens(JSON.stringify(value) ?? "");
  } catch {
    return 0;
  }
}
