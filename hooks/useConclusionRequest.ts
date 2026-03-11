"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Effect, Either } from "effect";
import { generateId } from "ai";
import type { Message } from "ai";
import { useSessionStore } from "@/stores/sessionStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { canInteract } from "@/lib/workspacePhase";
import { requestConclusion } from "@/services/conclusionClient";
import { appendTranscriptApi } from "@/services/sessionsClient";
import { remainingMs } from "@/lib/chatGuardrails";
import { whenRight } from "@/lib/optionHelpers";
import { toast } from "sonner";

export type ConclusionMessage = { role: "user" | "assistant" | "system"; content: string };

export function extractMessageContent(m: Message): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return (m.content as Array<{ text?: string }>)
      .map((p) => (p && typeof p === "object" && "text" in p ? String(p.text) : ""))
      .join("");
  }
  return "";
}

export function toConclusionMessages(messages: Message[]): ConclusionMessage[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: extractMessageContent(m),
  }));
}

export type UseConclusionRequestParams = {
  sessionId: string | undefined;
  isAnonymous: boolean;
  isConcluded: boolean;
  messages: Message[];
  setMessages: (valueOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
};

export type UseConclusionRequestResult = {
  /** The sessionId for which a conclusion has been requested (or is already in DB). */
  conclusionRequestedSessionId: string | undefined;
  /** Trigger a voluntary end-interview conclusion for the current session. */
  requestEndInterview: () => void;
  /** Whether the "End interview" button should be shown. */
  showEndInterviewButton: boolean;
};

/**
 * Manages all conclusion orchestration:
 * - Syncs server-confirmed `isConcluded` flag into session store and dedup ref.
 * - Detects session time expiry and auto-requests a conclusion.
 * - Provides `requestEndInterview` for voluntary end flows.
 *
 * Reads sessions, canvas state, and transcript store directly; requires only
 * `useChat` outputs and session props as params.
 */
export function useConclusionRequest({
  sessionId,
  isAnonymous,
  isConcluded,
  messages,
  setMessages,
}: UseConclusionRequestParams): UseConclusionRequestResult {
  const sessions = useSessionStore((s) => s.sessions);
  const isSessionActive = useWorkspaceStore((s) => canInteract(s.phase));
  const appendEntry = useTranscriptStore((s) => s.appendEntry);
  const canvasNodes = useCanvasStore((s) => s.nodes);
  const canvasEdges = useCanvasStore((s) => s.edges);

  /** Safely transition to inactive — no-op if already inactive. */
  const deactivate = useCallback((): void => {
    const p = useWorkspaceStore.getState().phase.phase;
    if (p === "active" || p === "loading-session") {
      useWorkspaceStore.getState().deactivateSession();
    }
  }, []);

  const conclusionRequestedRef = useRef<string | undefined>(undefined);
  const sessionHadTimeLeftRef = useRef<{ sessionId: string; hadTimeLeft: boolean }>({
    sessionId: "",
    hadTimeLeft: false,
  });
  const [_conclusionRequestedSessionId, setConclusionRequestedSessionId] = useState<
    string | undefined
  >(undefined);

  // Derive: if the server confirmed the session is already concluded, treat as requested.
  const conclusionRequestedSessionId =
    isConcluded && sessionId ? sessionId : _conclusionRequestedSessionId;

  // Sync server-confirmed conclusion with local ref + session store.
  useEffect(() => {
    if (isConcluded && sessionId) {
      deactivate();
      conclusionRequestedRef.current = sessionId;
    }
  }, [isConcluded, sessionId, deactivate]);

  // Auto-conclude when session time expires while the user has the tab open.
  // Skips sessions that already expired on page load (`sessionHadTimeLeftRef.hadTimeLeft` guard).
  useEffect(() => {
    if (!sessionId || isAnonymous) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const remaining = remainingMs(session);

    if (remaining > 0) {
      if (sessionHadTimeLeftRef.current.sessionId !== sessionId) {
        sessionHadTimeLeftRef.current = { sessionId, hadTimeLeft: false };
      }
      sessionHadTimeLeftRef.current.hadTimeLeft = true;
      return;
    }

    if (sessionHadTimeLeftRef.current.sessionId !== sessionId) {
      sessionHadTimeLeftRef.current = { sessionId, hadTimeLeft: false };
    }
    if (!sessionHadTimeLeftRef.current.hadTimeLeft) return;
    if (conclusionRequestedRef.current === sessionId) return;

    conclusionRequestedRef.current = sessionId;

    void Effect.runPromise(
      Effect.either(
        requestConclusion(sessionId, {
          messages: toConclusionMessages(messages),
          nodes: [...canvasNodes],
          edges: [...canvasEdges],
        })
      )
    ).then((either) => {
      setConclusionRequestedSessionId(sessionId);
      if (Either.isRight(either)) {
        const text = either.right;
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant" as const, content: text },
        ]);
        deactivate();
        if (text.trim().length > 0) {
          void Effect.runPromise(
            Effect.either(appendTranscriptApi(sessionId, "assistant", text))
          ).then((appendEither) =>
            whenRight(appendEither, (entry) => appendEntry(entry))
          );
        }
      } else {
        const err = either.left;
        if (err.status === 403) {
          setConclusionRequestedSessionId(sessionId);
          conclusionRequestedRef.current = sessionId;
          deactivate();
        } else {
          setConclusionRequestedSessionId(undefined);
          conclusionRequestedRef.current = undefined;
        }
        toast.error(err.error);
      }
    });
  }, [
    sessionId,
    isAnonymous,
    sessions,
    messages,
    setMessages,
    deactivate,
    appendEntry,
    canvasNodes,
    canvasEdges,
  ]);

  const requestEndInterview = useCallback((): void => {
    if (!sessionId) return;
    if (conclusionRequestedRef.current === sessionId) return;
    conclusionRequestedRef.current = sessionId;
    setConclusionRequestedSessionId(sessionId);
    deactivate();

    void Effect.runPromise(
      Effect.either(
        requestConclusion(sessionId, {
          messages: toConclusionMessages(messages),
          nodes: [...canvasNodes],
          edges: [...canvasEdges],
          user_requested_end: true as const,
        })
      )
    ).then((either) => {
      if (Either.isRight(either)) {
        const text = either.right;
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant" as const, content: text },
        ]);
        deactivate();
        if (text.trim().length > 0) {
          void Effect.runPromise(
            Effect.either(appendTranscriptApi(sessionId, "assistant", text))
          ).then((appendEither) =>
            whenRight(appendEither, (entry) => appendEntry(entry))
          );
        }
      } else {
        const err = either.left;
        toast.error(err.error);
        // Keep session concluded even on error — user explicitly chose to end.
        deactivate();
        conclusionRequestedRef.current = sessionId;
        setConclusionRequestedSessionId(sessionId);
      }
    });
  }, [sessionId, messages, canvasNodes, canvasEdges, setMessages, deactivate, appendEntry]);

  const showEndInterviewButton =
    sessionId !== undefined &&
    !isAnonymous &&
    conclusionRequestedSessionId !== sessionId &&
    isSessionActive;

  return { conclusionRequestedSessionId, requestEndInterview, showEndInterviewButton };
}
