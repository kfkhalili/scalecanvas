"use client";

import { useRef, useEffect } from "react";
import { Effect, Option } from "effect";
import type { Message } from "ai";
import { useRouter } from "next/navigation";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { loadAnonymousWorkspace } from "@/stores/anonymousWorkspaceStorage";
import { appendTranscriptBatchApi, saveCanvasApi } from "@/services/sessionsClient";
import { runBffHandoff, buildTranscriptEntries } from "@/lib/authHandoff";
import { whenSome } from "@/lib/optionHelpers";
import { toast } from "sonner";

export type UseAuthHandoffParams = {
  messages: Message[];
  setMessages: (valueOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
};

/**
 * Orchestrates the BFF auth-handoff flow:
 * - Watches `pendingSessionId` from the auth handoff store.
 * - On first detection: loads the anonymous workspace, persists the canvas and
 *   transcript to the new session, then navigates to it.
 * - Shows a sonner loading toast for the duration; replaces with an error toast
 *   if the canvas save fails permanently.
 *
 * Reads canvas and auth-handoff stores directly; takes only `useChat` outputs as params.
 */
export function useAuthHandoff({ messages, setMessages }: UseAuthHandoffParams): void {
  const router = useRouter();
  const pendingSessionIdOpt = useAuthHandoffStore((s) => s.pendingSessionId);
  const setPendingAuthHandoff = useAuthHandoffStore((s) => s.setPendingAuthHandoff);
  const setHandoffTranscript = useAuthHandoffStore((s) => s.setHandoffTranscript);
  const setAnonymousMessages = useAuthHandoffStore((s) => s.setAnonymousMessages);
  const setQuestionTitle = useAuthHandoffStore((s) => s.setQuestionTitle);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);

  const handoffDoneRef = useRef<string | null>(null);

  useEffect(() => {
    whenSome(pendingSessionIdOpt, (pendingSessionId) => {
      if (handoffDoneRef.current === pendingSessionId) return;
      handoffDoneRef.current = pendingSessionId;
      const loadingToastId = toast.loading("Saving your session…");

      loadAnonymousWorkspace();

      const anonMsgs = useAuthHandoffStore.getState().anonymousMessages;
      const messagesToUse: Message[] =
        messages.length > 0
          ? messages
          : anonMsgs.map((m) => ({
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

      void runBffHandoff({
        sessionId: pendingSessionId,
        messages: messagesToUse,
        getCanvasState,
        saveCanvasApi,
        setMessages,
        persistTranscript: (sid, entries) =>
            Effect.runPromise(
              Effect.either(appendTranscriptBatchApi(sid, entries))
            ),
        onTranscriptSaveError: () => {
          toast.dismiss(loadingToastId);
          toast.error(
            "Part of your conversation couldn't be saved. Sign in again to retry the session transfer."
          );
        },
        onCanvasSaveError: () => {
          toast.dismiss(loadingToastId);
          toast.error(
            "Your diagram couldn't be saved. You can keep working; try refreshing later to see if it's there."
          );
        },
        onHandoffComplete: (sid, filteredMsgs) => {
          toast.dismiss(loadingToastId);
          const entries = buildTranscriptEntries(sid, filteredMsgs, new Date().toISOString());
          setHandoffTranscript(Option.some({ sessionId: sid, entries }));
          setPendingAuthHandoff(Option.none());
          setAnonymousMessages([]);
          setQuestionTitle(Option.none());
          router.replace(`/${sid}`);
        },
      });
    });
  }, [
    pendingSessionIdOpt,
    messages,
    getCanvasState,
    setMessages,
    router,
    setPendingAuthHandoff,
    setHandoffTranscript,
    setAnonymousMessages,
    setQuestionTitle,
  ]);

}
