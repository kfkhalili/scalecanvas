"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useCanvasReview } from "@/hooks/useCanvasReview";
import { appendTranscriptApi, saveCanvasApi } from "@/services/sessionsClient";
import { performAnonymousEvalHandoff } from "@/lib/plg";
import { runBffHandoff, type RunBffHandoffParams } from "@/lib/authHandoff";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TranscriptView } from "./TranscriptView";
import { SignInButtons } from "./SignInButtons";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/lib/types";

const ANONYMOUS_PLACEHOLDER =
  "Start drawing and click Evaluate to get FAANG-level feedback.";

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
  isAnonymous?: boolean;
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
  isAnonymous = false,
}: ChatPanelProps): React.ReactElement {
  const router = useRouter();
  const appendEntry = useTranscriptStore((s) => s.appendEntry);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);
  const setHasAttemptedEval = useCanvasStore((s) => s.setHasAttemptedEval);
  const hasAttemptedEval = useCanvasStore((s) => s.hasAttemptedEval);
  const pendingSessionId = useAuthHandoffStore((s) => s.pendingSessionId);
  const setPendingAuthHandoff = useAuthHandoffStore((s) => s.setPendingAuthHandoff);

  const chatBody = useMemo(() => {
    const state = getCanvasState();
    const body: Record<string, unknown> = { nodes: state.nodes, edges: state.edges };
    if (pendingSessionId) body.session_id = pendingSessionId;
    return body;
  }, [getCanvasState, pendingSessionId]);

  const { messages, setMessages, input, setInput, handleSubmit, isLoading, reload } =
    useChat({
      api: "/api/chat",
      fetch: fetchWithTimeout,
      initialMessages: initialEntries.map(toMessage),
      body: chatBody,
      onFinish: (message) => {
        const handoffId = useAuthHandoffStore.getState().pendingSessionId;
        if (handoffId && message.role === "assistant") {
          setPendingAuthHandoff(null);
          router.replace(`/${handoffId}`);
          return;
        }
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

  const { evaluate, canEvaluate, isEvaluating } = useCanvasReview({
    messages,
    setMessages,
    isLoading,
  });
  const setEvaluateAction = useCanvasStore((s) => s.setEvaluateAction);

  const anonymousHandoff = useMemo(
    () => performAnonymousEvalHandoff(setHasAttemptedEval, setMessages),
    [setHasAttemptedEval, setMessages]
  );

  useEffect(() => {
    const action = isAnonymous
      ? { evaluate: anonymousHandoff, canEvaluate, isEvaluating: false }
      : { evaluate, canEvaluate, isEvaluating };
    setEvaluateAction(action);
    return () => setEvaluateAction(null);
  }, [isAnonymous, anonymousHandoff, evaluate, canEvaluate, isEvaluating, setEvaluateAction]);

  useEffect(() => {
    if (initialEntries.length === 0) setMessages([]);
  }, [initialEntries.length, setMessages]);

  const handoffDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingSessionId || !reload || pendingSessionId === handoffDoneRef.current) return;
    handoffDoneRef.current = pendingSessionId;
    runBffHandoff({
      sessionId: pendingSessionId,
      getCanvasState,
      saveCanvasApi,
      setMessages: setMessages as unknown as RunBffHandoffParams["setMessages"],
      reload,
      onCanvasSaveError: () =>
        toast.error(
          "Your diagram couldn't be saved. You can keep working; try refreshing later to see if it's there."
        ),
    });
  }, [pendingSessionId, getCanvasState, setMessages, reload]);

  const formRef = useRef<HTMLFormElement>(null);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    if (isAnonymous) {
      anonymousHandoff();
      setInput("");
      return;
    }
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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TranscriptView
            messages={displayMessages}
            emptyPlaceholder={isAnonymous ? ANONYMOUS_PLACEHOLDER : undefined}
          />
        </div>
        {isAnonymous && hasAttemptedEval && (
          <div className="shrink-0 border-t border-border/50 bg-muted/30 p-2">
            <SignInButtons redirectTo="/" />
          </div>
        )}
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
