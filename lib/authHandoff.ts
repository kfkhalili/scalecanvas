import { Effect, Either } from "effect";
import type { Message } from "ai";
import { isTeaserMessage } from "@/lib/plg";
import type { CanvasState, TranscriptEntry } from "@/lib/types";
import type { AnonymousMessage } from "@/stores/authHandoffStore";

export type RunBffHandoffParams = {
  sessionId: string;
  messages: Message[];
  getCanvasState: () => CanvasState;
  saveCanvasApi: (
    sessionId: string,
    state: CanvasState
  ) => Effect.Effect<undefined, { message: string }>;
  setMessages: (messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
  /**
   * Raw save attempt for transcript entries. Called with the full batch; must return
   * an Either so the caller can detect failure and trigger retry via saveWithBackoff.
   */
  persistTranscript: (
    sessionId: string,
    entries: { id: string; role: "user" | "assistant"; content: string }[]
  ) => Promise<Either.Either<undefined, { message: string }>>;
  onCanvasSaveError: () => void;
  onTranscriptSaveError?: () => void;
  /** Called after transcript is persisted; receives sessionId and filtered messages so client can store handoff transcript and navigate. */
  onHandoffComplete: (sessionId: string, filteredMessages: Message[]) => void;
};

/**
 * Attempts saveFn up to maxAttempts times with exponential backoff between retries.
 * Returns true if any attempt succeeds, false if all fail.
 * Delays: immediate → baseDelayMs → baseDelayMs×4 (e.g. 0ms → 600ms → 2400ms).
 */
export async function saveWithBackoff(
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
    onTranscriptSaveError,
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

  const entries: { id: string; role: "user" | "assistant"; content: string }[] = [];
  for (const m of filtered) {
    const role = m.role;
    const content = typeof m.content === "string" ? m.content : "";
    if ((role === "user" || role === "assistant") && content.length > 0) {
      entries.push({ id: m.id, role, content });
    }
  }

  if (entries.length > 0) {
    const transcriptSaved = await saveWithBackoff(
      () => persistTranscript(sessionId, entries),
      3,
      600
    );
    if (!transcriptSaved) onTranscriptSaveError?.();
  }
  setMessages(() => filtered);
  onHandoffComplete(sessionId, filtered);
}

/**
 * Builds the in-memory TranscriptEntry array shown immediately after handoff
 * (before the session page fetches from DB).
 */
export function buildTranscriptEntries(
  sessionId: string,
  filteredMsgs: Message[],
  now: string
): TranscriptEntry[] {
  return filteredMsgs.map((m) => ({
    id: m.id,
    sessionId,
    role: (
      m.role === "user" || m.role === "assistant" ? m.role : "assistant"
    ) as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : "",
    createdAt: now,
  }));
}

/**
 * Resolves which messages to use for the handoff transcript.
 *
 * If `useChatMessages` (from the active useChat hook) is non-empty, those are
 * used directly. Otherwise falls back to `anonymousMessages` (from localStorage
 * via the auth handoff store), mapping their free-form `role` string to the
 * `Message["role"]` union with unrecognised roles defaulting to `"assistant"`.
 */
export function resolveHandoffMessages(
  useChatMessages: Message[],
  anonymousMessages: AnonymousMessage[],
): Message[] {
  if (useChatMessages.length > 0) return useChatMessages;
  return anonymousMessages.map((m) => ({
    id: m.id,
    role:
      m.role === "user" ||
      m.role === "assistant" ||
      m.role === "system" ||
      m.role === "data"
        ? (m.role as Message["role"])
        : ("assistant" as const),
    content: m.content,
  }));
}
