"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useCanvasReview } from "@/hooks/useCanvasReview";
import { appendTranscriptApi } from "@/services/sessionsClient";
import { Button } from "@/components/ui/button";
import { TranscriptView } from "./TranscriptView";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/lib/types";

/** Fail fast; show retry message. Slow first response is usually Bedrock cold start—retry is often quick. */
const CHAT_REQUEST_TIMEOUT_MS = 60_000;

function fetchWithTimeout(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), CHAT_REQUEST_TIMEOUT_MS);
  const originalSignal = init?.signal;
  if (originalSignal) {
    originalSignal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      ac.abort();
    });
  }
  return fetch(url, { ...init, signal: ac.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

type ChatPanelProps = {
  sessionId?: string;
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
      fetch: fetchWithTimeout,
      initialMessages: initialEntries.map(toMessage),
      body: (() => {
        const state = getCanvasState();
        return { nodes: state.nodes, edges: state.edges };
      })(),
      onFinish: (message) => {
        if (message.role === "assistant" && message.content && sessionId) {
          appendTranscriptApi(sessionId, "assistant", message.content).then(
            (r) => r.match((entry) => appendEntry(entry), () => {})
          );
        }
      },
      onError: (err) => {
        const fallback =
          "Sorry, the assistant couldn't respond. Check your connection and try again.";
        const rawMessage =
          err && typeof err === "object" && "message" in err
            ? String((err as Error).message)
            : "";
        const isTimeout =
          rawMessage.includes("abort") || rawMessage.includes("timeout");
        const message = isTimeout
          ? "The request took too long. The first request can be slow—please try again; the next one is usually faster."
          : rawMessage || fallback;
        if (sessionId) {
          appendTranscriptApi(sessionId, "assistant", message).then((r) =>
            r.match((entry) => appendEntry(entry), () => {})
          );
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: message,
          },
        ]);
      },
    });

  useCanvasReview({ sessionId, messages, setMessages, isLoading });

  useEffect(() => {
    if (initialEntries.length > 0 && !didSetInitial.current) {
      setMessages(initialEntries.map(toMessage));
      didSetInitial.current = true;
    }
    if (initialEntries.length === 0) didSetInitial.current = false;
  }, [initialEntries, setMessages]);

  const formRef = useRef<HTMLFormElement>(null);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    if (sessionId) {
      appendTranscriptApi(sessionId, "user", content).then((r) =>
        r.match((entry) => appendEntry(entry), () => {})
      );
    }
    handleSubmit(e);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return; // Shift+Enter: new line (default textarea behavior)
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    formRef.current?.requestSubmit();
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
        ref={formRef}
        onSubmit={onFormSubmit}
        className="flex shrink-0 items-end gap-2 border-t p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask your Trainer"
          rows={2}
          className={cn(
            "flex min-h-9 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          )}
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
