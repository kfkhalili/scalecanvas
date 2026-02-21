/**
 * PLG (product-led growth): anonymous eval handoff message shown before sign-in.
 * Used when an anonymous user clicks Evaluate or sends a chat message.
 */
export const PLG_TEASER_MESSAGE =
  "I see you've started building your architecture. I have a critical question about your scaling strategy here. Sign in to unlock my feedback and start your free mock interview.";

/** Accepts the same updater shape as useChat's setMessages. */
type SetMessages = (
  fn: (prev: { id: string; role: "user" | "assistant" | "system" | "data"; content: string }[]) =>
    { id: string; role: "user" | "assistant" | "system" | "data"; content: string }[]
) => void;

/** True if a message is the PLG teaser (by id or content). */
export function isTeaserMessage(
  m: { id: string; content?: string }
): boolean {
  return m.id.startsWith("plg-teaser-") || m.content === PLG_TEASER_MESSAGE;
}

/**
 * Sets hasAttemptedEval and appends the teaser message to the transcript.
 * Call when an anonymous user clicks Evaluate or sends a chat message.
 */
export function performAnonymousEvalHandoff(
  setHasAttemptedEval: (value: boolean) => void,
  setMessages: SetMessages
): () => void {
  return () => {
    setHasAttemptedEval(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `plg-teaser-${Date.now()}`,
        role: "assistant" as const,
        content: PLG_TEASER_MESSAGE,
      },
    ]);
  };
}
