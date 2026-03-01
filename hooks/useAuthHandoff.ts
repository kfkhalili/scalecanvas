"use client";

import { useRef, useEffect } from "react";
import { Effect, Option } from "effect";
import type { Message } from "ai";
import { useRouter } from "next/navigation";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { loadAnonymousWorkspace } from "@/stores/anonymousWorkspaceStorage";
import { appendTranscriptApi, saveCanvasApi } from "@/services/sessionsClient";
import { runBffHandoff, type RunBffHandoffParams } from "@/lib/authHandoff";
import { whenSome } from "@/lib/optionHelpers";
import { toast } from "sonner";
import type { TranscriptEntry } from "@/lib/types";

export type UseAuthHandoffParams = {
  messages: Message[];
  setMessages: (valueOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
};

/**
 * Orchestrates the BFF auth-handoff flow:
 * - Watches `pendingSessionId` from the auth handoff store.
 * - On first detection: loads the anonymous workspace, persists the canvas and
 *   transcript to the new session, then navigates to it.
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

      loadAnonymousWorkspace();

      const currentFromChat = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
      }));
      const messagesToUse =
        currentFromChat.length > 0
          ? currentFromChat
          : useAuthHandoffStore.getState().anonymousMessages;

      void runBffHandoff({
        sessionId: pendingSessionId,
        messages: messagesToUse,
        getCanvasState,
        saveCanvasApi,
        // ai SDK's setMessages type vs MessageLike mismatch: safe, shapes are compatible at runtime.
        setMessages: setMessages as unknown as RunBffHandoffParams["setMessages"],
        persistTranscript: async (sid, entries) => {
          for (const { role, content } of entries) {
            await Effect.runPromise(
              Effect.either(appendTranscriptApi(sid, role, content))
            );
          }
        },
        onCanvasSaveError: () =>
          toast.error(
            "Your diagram couldn't be saved. You can keep working; try refreshing later to see if it's there."
          ),
        onHandoffComplete: (sid, filteredMsgs) => {
          const now = new Date().toISOString();
          const entries: TranscriptEntry[] = filteredMsgs.map((m) => ({
            id: m.id,
            sessionId: sid,
            role: (
              m.role === "user" || m.role === "assistant" ? m.role : "assistant"
            ) as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
            createdAt: now,
          }));
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
