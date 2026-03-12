"use client";

import { Option } from "effect";
import { useEffect } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { NodeLibrary } from "@/components/canvas/NodeLibrary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { NoSessionPrompt } from "@/components/billing/NoSessionPrompt";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { loadAnonymousWorkspace } from "@/stores/anonymousWorkspaceStorage";
import {
  initPersistenceBridge,
  teardownPersistence,
} from "@/lib/persistenceLifecycle";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useSessionContent } from "@/hooks/useSessionContent";

type InterviewSplitViewProps = {
  sessionId?: string;
  isAnonymous?: boolean;
  /** When true, session is a trial (post-handoff); ChatPanel uses design phase from first message. */
  isTrial?: boolean;
  /** Whether the session is currently active (no conclusion summary in DB). When false, session starts inactive on mount. */
  isActive?: boolean;
};

export function InterviewSplitView({
  sessionId,
  isAnonymous = false,
  isTrial = false,
  isActive = true,
}: InterviewSplitViewProps): React.ReactElement {
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);
  const entries = useTranscriptStore((s) => s.entries);

  // ── Workspace lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    const ws = useWorkspaceStore.getState();
    ws.reset();
    const cleanupBridge = initPersistenceBridge();

    if (!sessionId) {
      loadAnonymousWorkspace();
      if (isAnonymous) ws.enterAnonymous();
      useAuthHandoffStore.getState().setRehydrated(true);
      return () => { cleanupBridge(); teardownPersistence(); };
    }

    ws.loadSession(sessionId);
    if (!isActive) ws.deactivateSession();
    useAuthHandoffStore.getState().setRehydrated(true);
    return () => { cleanupBridge(); teardownPersistence(); };
  }, [sessionId, isActive, isAnonymous]);

  // ── Session ID sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(Option.some(sessionId));
      return () => setCurrentSessionId(Option.none());
    }
    setCurrentSessionId(Option.none());
  }, [sessionId, setCurrentSessionId]);

  // ── Content loading (canvas + transcript fetch, staleness, handoff) ─
  const { canvasReady, sessionReady } = useSessionContent(
    sessionId,
    isAnonymous,
  );

  // ── Render ───────────────────────────────────────────────────────────
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
                  initialEntries={entries}
                  isAnonymous={isAnonymous}
                  isTrial={isTrial}
                  isActive={isActive}
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
