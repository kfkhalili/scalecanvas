"use client";

import { useEffect, useRef, useState } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { AuthBar } from "@/components/layout/AuthBar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { NodeLibrary } from "@/components/canvas/NodeLibrary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import {
  fetchCanvas,
  fetchTranscript,
  saveCanvasApi,
} from "@/services/sessionsClient";
import { rehydrateCanvasStore } from "@/stores/canvasStore";
import { isSessionContentReady } from "@/lib/sessionLoading";
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
  const loadingSessionIdRef = useRef<string | null>(null);

  const [canvasReady, setCanvasReady] = useState(!sessionId);
  const [transcriptForSession, setTranscriptForSession] = useState<
    TranscriptEntry[] | null
  >(sessionId ? null : []);

  useEffect(() => {
    rehydrateCanvasStore();
  }, []);

  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId);
      return () => setCurrentSessionId(null);
    }
    setCurrentSessionId(null);
  }, [sessionId, setCurrentSessionId]);

  useEffect(() => {
    const empty = { nodes: [], edges: [], viewport: undefined };
    const prevId = previousSessionIdRef.current;
    previousSessionIdRef.current = sessionId ?? null;

    if (!sessionId) {
      if (!isAnonymous) setCanvasState(empty);
      setCanvasReady(true);
      return;
    }

    if (prevId != null && prevId !== sessionId) {
      const state = getCanvasState();
      saveCanvasApi(prevId, state).then(() => {});
    }

    loadingSessionIdRef.current = sessionId;
    setCanvasReady(false);

    fetchCanvas(sessionId).then((canvasResult) => {
      if (loadingSessionIdRef.current !== sessionId) return;
      canvasResult.match(
        (state) => setCanvasState(state.nodes.length > 0 ? state : empty),
        () => setCanvasState(empty)
      );
      setCanvasReady(true);
    });
  }, [sessionId, isAnonymous, setCanvasState, getCanvasState]);

  useEffect(() => {
    if (!sessionId) {
      setTranscriptForSession([]);
      setEntries([]);
      return;
    }
    const handoff = useAuthHandoffStore.getState().handoffTranscript;
    if (handoff?.sessionId === sessionId) {
      setTranscriptForSession(handoff.entries);
      setEntries(handoff.entries);
      // Clear handoff after a tick so a second effect run (e.g. Strict Mode) still sees it
      // and sets transcript again instead of overwriting with null + fetch
      const t = setTimeout(() => setHandoffTranscript(null), 0);
      return () => clearTimeout(t);
    }
    loadingSessionIdRef.current = sessionId;
    setTranscriptForSession(null);
    fetchTranscript(sessionId).then((result) => {
      if (loadingSessionIdRef.current !== sessionId) return;
      result.match(
        (list) => {
          setTranscriptForSession(list);
          setEntries(list);
        },
        () => {
          setTranscriptForSession([]);
          setEntries([]);
        }
      );
    });
  }, [sessionId, setEntries, setHandoffTranscript]);

  const sessionReady = isSessionContentReady(
    sessionId,
    canvasReady,
    transcriptForSession !== null
  );
  const initialEntries = transcriptForSession ?? entries;

  return (
    <div className="flex h-full w-full">
      <CollapsibleSidebar isAnonymous={isAnonymous} />
      <div className="relative min-h-0 min-w-0 flex-1">
        <AuthBar isAnonymous={isAnonymous} />
        <SplitScreen
          left={
            <div className="flex h-full min-w-0">
              <NodeLibrary className="w-52 shrink-0 border-r border-foreground/5 bg-background" />
              <div className="min-h-0 min-w-[200px] flex-1">
                {sessionReady ? (
                  <FlowCanvas
                    key={sessionId ?? "ephemeral"}
                    sessionId={sessionId ?? "ephemeral"}
                  />
                ) : (
                  <div className="h-full min-h-[400px] w-full bg-muted/30" />
                )}
              </div>
            </div>
          }
          right={
            <div className="flex h-full flex-col p-2">
              {sessionReady ? (
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
