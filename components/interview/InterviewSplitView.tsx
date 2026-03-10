"use client";

import { Effect, Either, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { NodeLibrary } from "@/components/canvas/NodeLibrary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { NoSessionPrompt } from "@/components/billing/NoSessionPrompt";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import {
  loadAnonymousWorkspace,
  persistAnonymousWorkspace,
} from "@/stores/anonymousWorkspaceStorage";
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
  /** When true, session is a trial (post-handoff); ChatPanel uses design phase from first message. */
  isTrial?: boolean;
  /** When true, session already has a conclusion summary — show canvas as read-only on mount. */
  isConcluded?: boolean;
};

/**
 * Canvas and transcript load together for the current session. We only show
 * session content (canvas + chat) when both have finished loading, so switching
 * sessions feels like one unit: a single loading state, then both appear together.
 */
export function InterviewSplitView({
  sessionId,
  isAnonymous = false,
  isTrial = false,
  isConcluded = false,
}: InterviewSplitViewProps): React.ReactElement {
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const entries = useTranscriptStore((s) => s.entries);
  const setHandoffTranscript = useAuthHandoffStore((s) => s.setHandoffTranscript);
  const pendingSessionIdOpt = useAuthHandoffStore((s) => s.pendingSessionId);
  const previousSessionIdRef = useRef<string | null>(null);
  const loadingCanvasSessionIdRef = useRef<string | null>(null);
  const loadingTranscriptSessionIdRef = useRef<string | null>(null);

  const [canvasReady, setCanvasReady] = useState(false);
  /** When true, authHandoffStore has been rehydrated so anonymous chat/canvas can be restored as one unit. */
  const [handoffReady, setHandoffReady] = useState(false);
  const [transcriptForSessionOpt, setTranscriptForSessionOpt] = useState<
    Option.Option<TranscriptEntry[]>
  >(sessionId ? Option.none() : Option.some([]));

  useEffect(() => {
    // Anonymous: single key (anonymousWorkspaceStorage) holds chat + canvas as one unit.
    if (!sessionId) {
      loadAnonymousWorkspace();
      queueMicrotask(() => {
        setCanvasReady(true);
        setHandoffReady(true);
      });
      let persistTimer: ReturnType<typeof setTimeout> | null = null;
      const schedulePersist = (): void => {
        if (persistTimer !== null) clearTimeout(persistTimer);
        persistTimer = setTimeout(persistAnonymousWorkspace, 500);
      };
      const flushPersist = (): void => {
        if (persistTimer !== null) {
          clearTimeout(persistTimer);
          persistTimer = null;
          persistAnonymousWorkspace();
        }
      };
      window.addEventListener("beforeunload", flushPersist);
      const unsubCanvas = useCanvasStore.subscribe(schedulePersist);
      const unsubHandoff = useAuthHandoffStore.subscribe(schedulePersist);
      return () => {
        unsubCanvas();
        unsubHandoff();
        window.removeEventListener("beforeunload", flushPersist);
        flushPersist();
      };
    }
    queueMicrotask(() => setHandoffReady(true));
  }, [sessionId]);

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
      // Anonymous canvasReady is set by the rehydration effect above.
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

    // First load after anonymous → session handoff: keep the in-memory canvas
    // and skip fetching. handoffTranscript is set only after runBffHandoff finishes,
    // so we also skip when pendingSessionId === sessionId (handoff in progress).
    if (prevId === null && (isHandoffForSession || isPendingHandoffSession)) {
      queueMicrotask(() => setCanvasReady(true));
      return;
    }

    if (prevId !== null && prevId !== sessionId) {
      const state = getCanvasState();
      void Effect.runPromise(
        Effect.either(saveCanvasApi(prevId, state))
      ).then(() => {});
    }

    loadingCanvasSessionIdRef.current = sessionId;
    queueMicrotask(() => setCanvasReady(false));

    void Effect.runPromise(Effect.either(fetchCanvas(sessionId))).then(
      (canvasEither) => {
        const stale = loadingCanvasSessionIdRef.current !== sessionId;
        if (stale) return;
        Either.match(canvasEither, {
          // On error, keep whatever canvas we already had in memory instead of
          // wiping it. This avoids losing an anonymous canvas when the backend
          // save/fetch fails (e.g. 500 from /canvas).
          onLeft: () => setCanvasReady(true),
          onRight: (state) =>
            setCanvasState(state.nodes.length > 0 ? state : empty),
        });
        setCanvasReady(true);
      }
    );
  }, [sessionId, isAnonymous, pendingSessionIdOpt, setCanvasState, getCanvasState]);

  useEffect(() => {
    if (!sessionId) {
      queueMicrotask(() => {
        setTranscriptForSessionOpt(Option.some([]));
        setEntries([]);
      });
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
        })
      );
      queueMicrotask(() => {
        setTranscriptForSessionOpt(Option.some(entriesFromAnonymous));
        setEntries(entriesFromAnonymous);
      });
      return;
    }

    loadingTranscriptSessionIdRef.current = sessionId;
    queueMicrotask(() => setTranscriptForSessionOpt(Option.none()));
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
  }, [sessionId, pendingSessionIdOpt, setEntries, setHandoffTranscript]);

  const sessionReady =
    !sessionId && isAnonymous
      ? canvasReady && handoffReady
      : isSessionContentReady(
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
                  handoffRehydrated={!sessionId ? handoffReady : true}
                  isTrial={isTrial}
                  isConcluded={isConcluded}
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
