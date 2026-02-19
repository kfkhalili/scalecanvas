"use client";

import { useEffect } from "react";
import { SplitScreen } from "@/components/layout/SplitScreen";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { SessionSelector } from "@/components/chat/SessionSelector";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { fetchCanvas, fetchTranscript } from "@/services/sessionsClient";

type InterviewSplitViewProps = { sessionId: string };

export function InterviewSplitView({
  sessionId,
}: InterviewSplitViewProps): React.ReactElement {
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const entries = useTranscriptStore((s) => s.entries);

  useEffect(() => {
    setCurrentSessionId(sessionId);
    return () => setCurrentSessionId(null);
  }, [sessionId, setCurrentSessionId]);

  useEffect(() => {
    fetchCanvas(sessionId).then((result) => {
      result.match(
        (state) => setCanvasState(state),
        () => setCanvasState({ nodes: [], edges: [] })
      );
    });
  }, [sessionId, setCanvasState]);

  useEffect(() => {
    fetchTranscript(sessionId).then((result) => {
      result.match(
        (list) => setEntries(list),
        () => setEntries([])
      );
    });
  }, [sessionId, setEntries]);

  return (
    <SplitScreen
      left={<FlowCanvas sessionId={sessionId} />}
      right={
        <div className="flex h-full flex-col border-l">
          <div className="shrink-0 border-b p-2">
            <SessionSelector />
          </div>
          <div className="min-h-0 flex-1 p-2">
            <ChatPanel sessionId={sessionId} initialEntries={entries} />
          </div>
        </div>
      }
    />
  );
}
