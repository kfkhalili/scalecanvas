import { isTeaserMessage } from "@/lib/plg";
import type { CanvasState } from "@/lib/types";

type MessageLike = { id: string; content?: string };

export type RunBffHandoffParams = {
  sessionId: string;
  getCanvasState: () => CanvasState;
  saveCanvasApi: (
    sessionId: string,
    state: CanvasState
  ) => Promise<{ isOk: () => boolean }>;
  setMessages: (fn: (prev: MessageLike[]) => MessageLike[]) => void;
  reload: () => void;
  onCanvasSaveError: () => void;
};

/**
 * Orchestrates the BFF handoff after auth: persist canvas (fire-and-forget),
 * then set messages (teaser filtered) and reload chat. On canvas save failure
 * invokes onCanvasSaveError (e.g. show toast). Pure TS; no React.
 */
export function runBffHandoff(params: RunBffHandoffParams): void {
  const {
    sessionId,
    getCanvasState,
    saveCanvasApi,
    setMessages,
    reload,
    onCanvasSaveError,
  } = params;

  const state = getCanvasState();
  saveCanvasApi(sessionId, state).then((result) => {
    if (!result.isOk()) onCanvasSaveError();
  });

  setMessages((prev) =>
    prev.filter(
      (m) =>
        !isTeaserMessage({
          id: m.id,
          content: typeof m.content === "string" ? m.content : "",
        })
    )
  );
  reload();
}
