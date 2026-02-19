"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { appendTranscriptApi } from "@/services/sessionsClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TranscriptView } from "./TranscriptView";
import type { TranscriptEntry } from "@/lib/types";

type ChatPanelProps = {
  sessionId: string;
  initialEntries: ReadonlyArray<TranscriptEntry>;
};

function toMessage(
  entry: TranscriptEntry
): { id: string; role: "user" | "assistant" | "system"; content: string } {
  return {
    id: entry.id,
    role: entry.role,
    content: entry.content,
  };
}

export function ChatPanel({
  sessionId,
  initialEntries,
}: ChatPanelProps): React.ReactElement {
  const appendEntry = useTranscriptStore((s) => s.appendEntry);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);
  const didSetInitial = useRef(false);

  const { messages, setMessages, input, setInput, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      initialMessages: initialEntries.map(toMessage),
      body: (() => {
        const state = getCanvasState();
        return { nodes: state.nodes, edges: state.edges };
      })(),
      onFinish: (message) => {
        if (message.role === "assistant" && message.content) {
          appendTranscriptApi(sessionId, "assistant", message.content).then(
            (r) => r.match((entry) => appendEntry(entry), () => {})
          );
        }
      },
      onError: () => {
        const placeholder = "The AI interviewer will reply here in Phase 6.";
        appendTranscriptApi(sessionId, "assistant", placeholder).then((r) =>
          r.match((entry) => appendEntry(entry), () => {})
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `stub-${Date.now()}`,
            role: "assistant",
            content: placeholder,
          },
        ]);
      },
    });

  useEffect(() => {
    if (initialEntries.length > 0 && !didSetInitial.current) {
      setMessages(initialEntries.map(toMessage));
      didSetInitial.current = true;
    }
    if (initialEntries.length === 0) didSetInitial.current = false;
  }, [initialEntries, setMessages]);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    appendTranscriptApi(sessionId, "user", content).then((r) =>
      r.match((entry) => appendEntry(entry), () => {})
    );
    handleSubmit(e);
  };

  const displayMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: typeof m.content === "string" ? m.content : "",
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <TranscriptView messages={displayMessages} />
      </div>
      <form
        onSubmit={onFormSubmit}
        className="flex shrink-0 gap-2 border-t p-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="min-w-0 flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
