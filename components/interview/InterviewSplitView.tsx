"use client";

import { useEffect } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { AuthBar } from "@/components/layout/AuthBar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { fetchCanvas, fetchTranscript } from "@/services/sessionsClient";

type InterviewSplitViewProps = {
  sessionId?: string;
  isAnonymous?: boolean;
};

export function InterviewSplitView({
  sessionId,
  isAnonymous = false,
}: InterviewSplitViewProps): React.ReactElement {
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const entries = useTranscriptStore((s) => s.entries);

  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId);
      return () => setCurrentSessionId(null);
    }
    setCurrentSessionId(null);
  }, [sessionId, setCurrentSessionId]);

  useEffect(() => {
    if (!sessionId) {
      setCanvasState({ nodes: [], edges: [] });
      return;
    }
    fetchCanvas(sessionId).then((result) => {
      result.match(
        (state) => setCanvasState(state),
        () => setCanvasState({ nodes: [], edges: [] })
      );
    });
  }, [sessionId, setCanvasState]);

  useEffect(() => {
    if (!sessionId) {
      setEntries([]);
      return;
    }
    fetchTranscript(sessionId).then((result) => {
      result.match(
        (list) => setEntries(list),
        () => setEntries([])
      );
    });
  }, [sessionId, setEntries]);

  return (
    <div className="flex h-full w-full">
      <CollapsibleSidebar isAnonymous={isAnonymous} />
      <div className="relative min-h-0 min-w-0 flex-1">
        <AuthBar isAnonymous={isAnonymous} />
        <SplitScreen
          left={<FlowCanvas sessionId={sessionId ?? "ephemeral"} />}
          right={
            <div className="flex h-full flex-col p-2">
              <ChatPanel sessionId={sessionId} initialEntries={entries} />
            </div>
          }
        />
      </div>
    </div>
  );
}
