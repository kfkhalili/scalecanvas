import { Effect, Either } from "effect";
import type { Message } from "ai";
import { isTeaserMessage } from "@/lib/plg";
import type { CanvasState } from "@/lib/types";

export type RunBffHandoffParams = {
  sessionId: string;
  messages: Message[];
  getCanvasState: () => CanvasState;
  saveCanvasApi: (
    sessionId: string,
    state: CanvasState
  ) => Effect.Effect<undefined, { message: string }>;
  setMessages: (messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
  /** Persist filtered messages to the new session's transcript; called before onHandoffComplete. */
  persistTranscript: (
    sessionId: string,
    entries: { role: "user" | "assistant"; content: string }[]
  ) => Promise<void>;
  onCanvasSaveError: () => void;
  /** Called after transcript is persisted; receives sessionId and filtered messages so client can store handoff transcript and navigate. */
  onHandoffComplete: (sessionId: string, filteredMessages: Message[]) => void;
};

/**
 * Attempts saveFn up to maxAttempts times with exponential backoff between retries.
 * Returns true if any attempt succeeds, false if all fail.
 * Delays: immediate → baseDelayMs → baseDelayMs×4 (e.g. 0ms → 600ms → 2400ms).
 */
async function saveWithBackoff(
  saveFn: () => Promise<Either.Either<undefined, { message: string }>>,
  maxAttempts: number,
  baseDelayMs: number
): Promise<boolean> {
  let delayMs = baseDelayMs;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 4;
    }
    const result = await saveFn();
    if (Either.isRight(result)) return true;
  }
  return false;
}

/**
 * Orchestrates the BFF handoff after auth: await canvas persist (up to 3 attempts with
 * exponential backoff so navigation cannot abort an in-flight save), filter out teaser,
 * persist chat to new session transcript, update local messages, then call onHandoffComplete.
 * On permanent canvas save failure invokes onCanvasSaveError then continues with handoff.
 */
export async function runBffHandoff(params: RunBffHandoffParams): Promise<void> {
  const {
    sessionId,
    messages,
    getCanvasState,
    saveCanvasApi,
    setMessages,
    persistTranscript,
    onCanvasSaveError,
    onHandoffComplete,
  } = params;

  const state = getCanvasState();
  const trySave = () =>
    Effect.runPromise(Effect.either(saveCanvasApi(sessionId, state)));

  const saved = await saveWithBackoff(trySave, 3, 600);
  if (!saved) onCanvasSaveError();

  const filtered = messages.filter(
    (m) =>
      !isTeaserMessage({
        id: m.id,
        content: typeof m.content === "string" ? m.content : "",
      })
  );

  const entries: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of filtered) {
    const role = m.role;
    const content = typeof m.content === "string" ? m.content : "";
    if ((role === "user" || role === "assistant") && content.length > 0) {
      entries.push({ role, content });
    }
  }

  await persistTranscript(sessionId, entries);
  setMessages(() => filtered);
  onHandoffComplete(sessionId, filtered);
}
