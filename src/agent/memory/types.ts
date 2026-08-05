import type { ChatCompletionMessageParam } from "together-ai/resources/chat/completions";

/**
 * Structured working memory: the slots the agent has actually established
 * during the conversation, kept separate from the transcript.
 *
 * Why separate? The transcript is what the model reads; facts are what the
 * *system* trusts. Authorisation decisions and UI state read from here, so they
 * never depend on re-parsing prose out of the conversation.
 */
export interface SessionFacts {
  /** Email the customer supplied and that matched an order. */
  verifiedEmail?: string;
  /** Orders the agent has successfully opened this session. */
  knownOrderIds: string[];
  /** Returns created this session, so the agent never files a duplicate. */
  createdReturnIds: string[];
  escalated?: boolean;
}

export interface Session {
  id: string;
  createdAt: number;
  /**
   * Full model-visible transcript, excluding the system message (which is
   * rebuilt each turn from the current facts).
   */
  messages: ChatCompletionMessageParam[];
  facts: SessionFacts;
}

export function emptyFacts(): SessionFacts {
  return { knownOrderIds: [], createdReturnIds: [] };
}
