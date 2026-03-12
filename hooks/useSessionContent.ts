/**
 * useSessionContent — encapsulates canvas + transcript fetch orchestration.
 *
 * Uses the session-scoped AbortController from the workspace store to cancel
 * in-flight fetches on session switch, replacing manual staleness refs.
 * The component just reads `canvasReady`, `transcriptReady`, and `sessionReady`.
 */

import { Effect, Either, Option } from "effect";
import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { fetchCanvas, fetchTranscript } from "@/services/sessionsClient";
import { getSessionSignal } from "@/stores/workspaceStore";
import { getPersistence } from "@/lib/persistenceLifecycle";
import { whenSome } from "@/lib/optionHelpers";
import { isSessionContentReady } from "@/lib/sessionLoading";
import type { TranscriptEntry } from "@/lib/types";

type SessionContentResult = {
  canvasReady: boolean;
  transcriptReady: boolean;
  sessionReady: boolean;
};

export function useSessionContent(
  sessionId: string | undefined,
  isAnonymous: boolean,
): SessionContentResult {
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const setHandoffTranscript = useAuthHandoffStore((s) => s.setHandoffTranscript);
  const pendingSessionIdOpt = useAuthHandoffStore((s) => s.pendingSessionId);
  const handoffReady = useAuthHandoffStore((s) => s.rehydrated);
  const transcriptReady = useTranscriptStore((s) => s.transcriptReady);

  const canvasReady = useCanvasStore((s) => s.canvasReady);

  const previousSessionIdRef = useRef<string | null>(null);

  // ── Canvas fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    const empty = { nodes: [], edges: [], viewport: undefined };
    const prevId = previousSessionIdRef.current;
    previousSessionIdRef.current = sessionId ?? null;

    if (!sessionId) {
      useCanvasStore.getState().setCanvasReady(true);
      return;
    }

    const handoffOpt = useAuthHandoffStore.getState().handoffTranscript;
    const isHandoffForSession = Option.match(handoffOpt, {
      onNone: () => false,
      onSome: (handoff) => handoff.sessionId === sessionId,
    });
    const isPendingHandoffSession = Option.match(pendingSessionIdOpt, {
      onNone: () => false,
      onSome: (pendingId) => pendingId === sessionId,
    });

    if (prevId === null && (isHandoffForSession || isPendingHandoffSession)) {
      useCanvasStore.getState().setCanvasReady(true);
      return;
    }

    if (prevId !== null && prevId !== sessionId) {
      void getPersistence().flush();
    }

    const signal = getSessionSignal();
    useCanvasStore.getState().setCanvasReady(false);

    void Effect.runPromise(Effect.either(fetchCanvas(sessionId, { signal }))).then(
      (canvasEither) => {
        if (signal?.aborted) return;
        Either.match(canvasEither, {
          onLeft: () => useCanvasStore.getState().setCanvasReady(true),
          onRight: (state) =>
            setCanvasState(state.nodes.length > 0 ? state : empty),
        });
        useCanvasStore.getState().setCanvasReady(true);
      },
    );
  }, [sessionId, isAnonymous, pendingSessionIdOpt, setCanvasState]);

  // ── Transcript fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      useTranscriptStore.getState().setTranscriptReady(true);
      setEntries([]);
      return;
    }

    const handoffOpt = useAuthHandoffStore.getState().handoffTranscript;
    const matched = Option.flatMap(handoffOpt, (handoff) =>
      handoff.sessionId === sessionId
        ? Option.some(handoff)
        : Option.none(),
    );
    let cleanup: (() => void) | undefined;
    whenSome(matched, (handoff) => {
      useTranscriptStore.getState().setTranscriptReady(true);
      setEntries(handoff.entries);
      const t = setTimeout(() => setHandoffTranscript(Option.none()), 0);
      cleanup = () => clearTimeout(t);
    });
    if (Option.isSome(matched)) return cleanup;

    const isPendingHandoffSession = Option.match(pendingSessionIdOpt, {
      onNone: () => false,
      onSome: (pendingId) => pendingId === sessionId,
    });
    if (isPendingHandoffSession) {
      const now = new Date().toISOString();
      const anonymousMessages = useAuthHandoffStore.getState().anonymousMessages;
      const entriesFromAnonymous: TranscriptEntry[] = anonymousMessages.map(
        (m) => ({
          id: m.id,
          sessionId,
          role: (m.role === "user" || m.role === "assistant" ? m.role : "assistant") as "user" | "assistant",
          content: m.content,
          createdAt: now,
        }),
      );
      useTranscriptStore.getState().setTranscriptReady(true);
      setEntries(entriesFromAnonymous);
      return;
    }

    const signal = getSessionSignal();
    useTranscriptStore.getState().setTranscriptReady(false);
    void Effect.runPromise(Effect.either(fetchTranscript(sessionId, { signal }))).then(
      (result) => {
        if (signal?.aborted) return;
        Either.match(result, {
          onLeft: () => setEntries([]),
          onRight: (list) => setEntries(list),
        });
        useTranscriptStore.getState().setTranscriptReady(true);
      },
    );
  }, [sessionId, pendingSessionIdOpt, setEntries, setHandoffTranscript]);

  // ── Derived readiness ────────────────────────────────────────────────
  const sessionReady =
    !sessionId && isAnonymous
      ? canvasReady && handoffReady
      : isSessionContentReady(sessionId, canvasReady, transcriptReady);

  return { canvasReady, transcriptReady, sessionReady };
}
