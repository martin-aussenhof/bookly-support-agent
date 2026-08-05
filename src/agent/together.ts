import "server-only";

import Together from "together-ai";

let client: Together | undefined;

/**
 * Lazily constructed singleton, so importing the agent layer in a test or a
 * build step does not require an API key to be present.
 */
export function together(): Together {
  if (!client) {
    if (!process.env.TOGETHER_API_KEY) {
      throw new Error(
        "TOGETHER_API_KEY is not set. Copy .env.example to .env.local and add your key.",
      );
    }
    client = new Together({ apiKey: process.env.TOGETHER_API_KEY });
  }
  return client;
}
