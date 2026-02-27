import { Effect, Either } from "effect";
import { isTeaserMessage } from "@/lib/plg";
import type { CanvasState } from "@/lib/types";

type MessageLike = { id: string; role?: string; content?: string };

export type RunBffHandoffParams = {
  sessionId: string;
  messages: MessageLike[];
  getCanvasState: () => CanvasState;
  saveCanvasApi: (
    sessionId: string,
    state: CanvasState
  ) => Effect.Effect<undefined, { message: string }>;
  setMessages: (fn: (prev: MessageLike[]) => MessageLike[]) => void;
  /** Persist filtered messages to the new session's transcript; called before onHandoffComplete. */
  persistTranscript: (
    sessionId: string,
    entries: { role: "user" | "assistant"; content: string }[]
  ) => Promise<void>;
  onCanvasSaveError: () => void;
  /** Called after transcript is persisted; receives sessionId and filtered messages so client can store handoff transcript and navigate. */
  onHandoffComplete: (sessionId: string, filteredMessages: MessageLike[]) => void;
};

/**
 * Orchestrates the BFF handoff after auth: persist canvas (fire-and-forget),
 * filter out teaser, persist chat to new session transcript, update local messages, then call onHandoffComplete.
 * On canvas save failure invokes onCanvasSaveError (e.g. show toast).
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

  void trySave().then((first) => {
    if (Either.isRight(first)) return;
    setTimeout(() => {
      void trySave().then((second) =>
        Either.match(second, {
          onLeft: onCanvasSaveError,
          onRight: () => {},
        })
      );
    }, 400);
  });

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
