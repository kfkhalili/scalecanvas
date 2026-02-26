"use client";

import { Effect, Either, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { NodeLibrary } from "@/components/canvas/NodeLibrary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { NoSessionPrompt } from "@/components/billing/NoSessionPrompt";
import {
  useCanvasStore,
  rehydrateCanvasStore,
  onCanvasRehydrationFinished,
  applyPersistedCanvasStateSync,
} from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import {
  fetchCanvas,
  fetchTranscript,
  saveCanvasApi,
} from "@/services/sessionsClient";
import { isSessionContentReady } from "@/lib/sessionLoading";
import { whenSome } from "@/lib/optionHelpers";
import type { TranscriptEntry } from "@/lib/types";

type InterviewSplitViewProps = {
  sessionId?: string;
  isAnonymous?: boolean;
};

/**
 * Canvas and transcript load together for the current session. We only show
 * session content (canvas + chat) when both have finished loading, so switching
 * sessions feels like one unit: a single loading state, then both appear together.
 */
export function InterviewSplitView({
  sessionId,
  isAnonymous = false,
}: InterviewSplitViewProps): React.ReactElement {
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const entries = useTranscriptStore((s) => s.entries);
  const setHandoffTranscript = useAuthHandoffStore((s) => s.setHandoffTranscript);
  const previousSessionIdRef = useRef<string | null>(null);
  const loadingCanvasSessionIdRef = useRef<string | null>(null);
  const loadingTranscriptSessionIdRef = useRef<string | null>(null);

  const [canvasReady, setCanvasReady] = useState(false);
  const [transcriptForSessionOpt, setTranscriptForSessionOpt] = useState<
    Option.Option<TranscriptEntry[]>
  >(sessionId ? Option.none() : Option.some([]));

  useEffect(() => {
    // For anonymous users (no sessionId) localStorage is the only persistence.
    // Apply persisted state synchronously first so FlowCanvas never mounts with
    // empty state and overwrites storage; then run async rehydrate so the
    // persist middleware stays in sync, and set canvasReady so the canvas shows.
    if (!sessionId) {
      applyPersistedCanvasStateSync();
      setCanvasReady(true);
      const unsubscribe = onCanvasRehydrationFinished(() =>
        setCanvasReady(true)
      );
      rehydrateCanvasStore();
      return () => unsubscribe?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(Option.some(sessionId));
      return () => setCurrentSessionId(Option.none());
    }
    setCurrentSessionId(Option.none());
  }, [sessionId, setCurrentSessionId]);

  useEffect(() => {
    const empty = { nodes: [], edges: [], viewport: undefined };
    const prevId = previousSessionIdRef.current;
    previousSessionIdRef.current = sessionId ?? null;

    if (!sessionId) {
      if (!isAnonymous) {
        setCanvasState(empty);
        setCanvasReady(true);
      }
      // Anonymous canvasReady is set by the rehydration effect above.
      return;
    }

    if (prevId !== null && prevId !== sessionId) {
      const state = getCanvasState();
      void Effect.runPromise(
        Effect.either(saveCanvasApi(prevId, state))
      ).then(() => {});
    }

    loadingCanvasSessionIdRef.current = sessionId;
    setCanvasReady(false);

    void Effect.runPromise(Effect.either(fetchCanvas(sessionId))).then(
      (canvasEither) => {
        const stale = loadingCanvasSessionIdRef.current !== sessionId;
        if (stale) return;
        Either.match(canvasEither, {
          onLeft: () => setCanvasState(empty),
          onRight: (state) =>
            setCanvasState(state.nodes.length > 0 ? state : empty),
        });
        setCanvasReady(true);
      }
    );
  }, [sessionId, isAnonymous, setCanvasState, getCanvasState]);

  useEffect(() => {
    if (!sessionId) {
      setTranscriptForSessionOpt(Option.some([]));
      setEntries([]);
      return;
    }
    const handoffOpt = useAuthHandoffStore.getState().handoffTranscript;
    const matched = Option.flatMap(handoffOpt, (handoff) =>
      handoff.sessionId === sessionId
        ? Option.some(handoff)
        : Option.none()
    );
    let cleanup: (() => void) | undefined;
    whenSome(matched, (handoff) => {
      setTranscriptForSessionOpt(Option.some(handoff.entries));
      setEntries(handoff.entries);
      const t = setTimeout(() => setHandoffTranscript(Option.none()), 0);
      cleanup = () => clearTimeout(t);
    });
    if (Option.isSome(matched)) return cleanup;
    loadingTranscriptSessionIdRef.current = sessionId;
    setTranscriptForSessionOpt(Option.none());
    void Effect.runPromise(Effect.either(fetchTranscript(sessionId))).then(
      (result) => {
        const stale = loadingTranscriptSessionIdRef.current !== sessionId;
        if (stale) return;
        Either.match(result, {
          onLeft: () => {
            setTranscriptForSessionOpt(Option.some([]));
            setEntries([]);
          },
          onRight: (list) => {
            setTranscriptForSessionOpt(Option.some(list));
            setEntries(list);
          },
        });
      }
    );
  }, [sessionId, setEntries, setHandoffTranscript]);

  const sessionReady = isSessionContentReady(
    sessionId,
    canvasReady,
    Option.isSome(transcriptForSessionOpt)
  );
  const initialEntries = Option.getOrElse(transcriptForSessionOpt, () => entries);

  return (
    <div className="flex h-full w-full">
      <CollapsibleSidebar isAnonymous={isAnonymous} />
      <div className="relative min-h-0 min-w-0 flex-1">
        <SplitScreen
          left={
            <div className="flex h-full min-w-0">
              <NodeLibrary className="w-52 shrink-0 border-r border-foreground/5 bg-background" isAnonymous={isAnonymous} />
              <div className="min-h-0 min-w-[200px] flex-1">
                {sessionReady && canvasReady ? (
                  <FlowCanvas
                    key={sessionId ?? "ephemeral"}
                    sessionIdOpt={Option.some(sessionId ?? "ephemeral")}
                  />
                ) : (
                  <div className="h-full min-h-[400px] w-full bg-muted/30" />
                )}
              </div>
            </div>
          }
          right={
            <div className="flex h-full flex-col p-2">
              {!sessionId && !isAnonymous ? (
                <NoSessionPrompt />
              ) : sessionReady ? (
                <ChatPanel
                  key={sessionId ?? "anon"}
                  sessionId={sessionId}
                  initialEntries={initialEntries}
                  isAnonymous={isAnonymous}
                />
              ) : (
                <div className="min-h-0 flex-1 bg-muted/30" />
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
