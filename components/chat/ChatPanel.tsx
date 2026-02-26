"use client";

import { Effect, Option } from "effect";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { generateId } from "ai";
import { Lightbulb, Maximize2, Minimize2 } from "lucide-react";
import { getRandomQuestion } from "@/lib/questions";
import { useCanvasStore } from "@/stores/canvasStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useSessionStore } from "@/stores/sessionStore";
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
import { whenSome, whenRight } from "@/lib/optionHelpers";
import type { TranscriptEntry } from "@/lib/types";

const CHAT_INPUT_MIN_HEIGHT_PX = 40;
const CHAT_INPUT_MAX_HEIGHT_PX = 168; // ~7 lines
const CHAT_INPUT_EXPANDED_MAX_HEIGHT_PX = 320; // ~13 lines in full-screen

const ANONYMOUS_PLACEHOLDER =
  "Start drawing and click Evaluate to get FAANG-level feedback.";

import { fetchWithGuardrail, transcriptEntryToMessage } from "@/lib/chatHelpers";

type ChatPanelProps = {
  sessionId?: string;
  initialEntries: ReadonlyArray<TranscriptEntry>;
  isAnonymous?: boolean;
};

const toMessage = transcriptEntryToMessage;

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
  const pendingSessionIdOpt = useAuthHandoffStore((s) => s.pendingSessionId);
  const setPendingAuthHandoff = useAuthHandoffStore((s) => s.setPendingAuthHandoff);
  const setHandoffTranscript = useAuthHandoffStore((s) => s.setHandoffTranscript);
  const setAnonymousMessages = useAuthHandoffStore((s) => s.setAnonymousMessages);
  const setQuestionTitle = useAuthHandoffStore((s) => s.setQuestionTitle);
  const isSessionActive = useSessionStore((s) => s.isSessionActive);
  const setSessionActive = useSessionStore((s) => s.setSessionActive);
  const activeQuestionOpt = useQuestionStore((s) => s.activeQuestion);
  const hintIndex = useQuestionStore((s) => s.hintIndex);
  const setInitialQuestion = useQuestionStore((s) => s.setInitialQuestion);
  const incrementHint = useQuestionStore((s) => s.incrementHint);

  const canvasNodes = useCanvasStore((s) => s.nodes);
  const canvasEdges = useCanvasStore((s) => s.edges);
  const chatBody = useMemo(
    () => {
      const resolvedSessionId = sessionId ?? Option.getOrUndefined(pendingSessionIdOpt);
      return {
        nodes: canvasNodes,
        edges: canvasEdges,
        ...(resolvedSessionId ? { session_id: resolvedSessionId } : {}),
      };
    },
    [canvasNodes, canvasEdges, sessionId, pendingSessionIdOpt]
  );

  const { messages, setMessages, input, setInput, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      fetch: fetchWithGuardrail,
      initialMessages: initialEntries.map(toMessage),
      body: chatBody,
      onFinish: (message) => {
        const handoffIdOpt = useAuthHandoffStore.getState().pendingSessionId;
        let handoffHandled = false;
        whenSome(handoffIdOpt, (handoffId) => {
          if (message.role === "assistant") {
            setPendingAuthHandoff(Option.none());
            router.replace(`/${handoffId}`);
            handoffHandled = true;
          }
        });
        if (handoffHandled) return;
        if (message.role === "assistant" && message.content && sessionId) {
          void Effect.runPromise(
            Effect.either(
              appendTranscriptApi(sessionId, "assistant", message.content)
            )
          ).then((either) =>
            whenRight(either, (entry) => appendEntry(entry))
          );
        }
      },
      onError: (err) => {
        const statusCodeOpt = Option.fromNullable(
          err &&
            typeof err === "object" &&
            "statusCode" in err
            ? (err as Error & { statusCode: number }).statusCode
            : null
        );
        let handled = false;
        whenSome(statusCodeOpt, (statusCode) => {
          if (statusCode === 403) {
            toast.error("Interview time has expired.");
            setSessionActive(false);
            handled = true;
          }
          if (statusCode === 401) {
            toast.error("Unauthorized.");
            setSessionActive(false);
            handled = true;
          }
        });
        if (handled) return;
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
          void Effect.runPromise(
            Effect.either(
              appendTranscriptApi(sessionId, "assistant", message)
            )
          ).then((either) =>
            whenRight(either, (entry) => appendEntry(entry))
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
    sessionId: Option.orElse(Option.fromNullable(sessionId), () => pendingSessionIdOpt),
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
    setEvaluateAction(Option.some(action));
    return () => setEvaluateAction(Option.none());
  }, [isAnonymous, anonymousHandoff, evaluate, canEvaluate, isEvaluating, setEvaluateAction]);

  useEffect(() => {
    if (initialEntries.length === 0) setMessages([]);
  }, [initialEntries.length, setMessages]);

  useEffect(() => {
    const noActiveQuestion = Option.isNone(activeQuestionOpt);
    if (messages.length === 0 && noActiveQuestion) {
      if (!isAnonymous) {
        const stored = useAuthHandoffStore.getState().anonymousMessages;
        if (stored.length > 0) return;
      }
      const question = getRandomQuestion();
      setInitialQuestion(question);
      setQuestionTitle(Option.some(question.title));
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: question.prompt,
        },
      ]);
      return;
    }
    if (messages.length > 0 && noActiveQuestion && !isAnonymous) {
      const question = getRandomQuestion();
      setInitialQuestion(question);
      const currentTitleOpt = useAuthHandoffStore.getState().questionTitle;
      if (Option.isNone(currentTitleOpt))
        setQuestionTitle(Option.some(question.title));
    }
  }, [messages.length, activeQuestionOpt, isAnonymous, setInitialQuestion, setQuestionTitle, setMessages]);

  useEffect(() => {
    if (sessionId) setSessionActive(true);
  }, [sessionId, setSessionActive]);

  useEffect(() => {
    if (isAnonymous && messages.length > 0) {
      setAnonymousMessages(
        messages.map((m) => ({
          id: m.id,
          role: typeof m.role === "string" ? m.role : "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }))
      );
    }
  }, [isAnonymous, messages, setAnonymousMessages]);

  const terminateHandledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of messages) {
      const raw = (m as { toolInvocations?: Array<{ toolName?: string; args?: { reason?: string }; result?: unknown }> }).toolInvocations;
      const invs = raw ?? [];
      for (let i = 0; i < invs.length; i++) {
        const inv = invs[i];
        if (inv?.toolName === "terminate_interview") {
          const key = `${m.id ?? ""}-${i}`;
          if (terminateHandledRef.current.has(key)) continue;
          terminateHandledRef.current.add(key);
          const reason = Option.getOrElse(
            typeof inv.args?.reason === "string"
              ? Option.some(inv.args.reason)
              : typeof inv.result === "string"
                ? Option.some(inv.result)
                : Option.none(),
            () => "Interview ended."
          );
          toast.error(reason);
          setSessionActive(false);
        }
      }
    }
  }, [messages, setSessionActive]);

  const handoffDoneRef = useRef<string | null>(null);
  useEffect(() => {
    whenSome(pendingSessionIdOpt, (pendingSessionId) => {
      if (handoffDoneRef.current === pendingSessionId) return;
      handoffDoneRef.current = pendingSessionId;
      const sessionIdForHandoff = pendingSessionId;
      const currentFromChat = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
      }));
      const messagesToUse =
        currentFromChat.length > 0
          ? currentFromChat
          : useAuthHandoffStore.getState().anonymousMessages;
      runBffHandoff({
        sessionId: sessionIdForHandoff,
        messages: messagesToUse,
        getCanvasState,
        saveCanvasApi,
        setMessages: setMessages as unknown as RunBffHandoffParams["setMessages"],
        persistTranscript: async (sid, entries) => {
          for (const { role, content } of entries) {
            await Effect.runPromise(
              Effect.either(appendTranscriptApi(sid, role, content))
            );
          }
        },
        onCanvasSaveError: () =>
          toast.error(
            "Your diagram couldn't be saved. You can keep working; try refreshing later to see if it's there."
          ),
        onHandoffComplete: (sid, filteredMsgs) => {
          const now = new Date().toISOString();
          const entries: TranscriptEntry[] = filteredMsgs.map((m) => ({
            id: m.id,
            sessionId: sid,
            role: (m.role === "user" || m.role === "assistant" ? m.role : "assistant") as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
            createdAt: now,
          }));
          setHandoffTranscript(Option.some({ sessionId: sid, entries }));
          setPendingAuthHandoff(Option.none());
          setAnonymousMessages([]);
          setQuestionTitle(Option.none());
          router.replace(`/${sid}`);
        },
      });
    });
  }, [pendingSessionIdOpt, messages, getCanvasState, setMessages, router, setPendingAuthHandoff, setHandoffTranscript, setAnonymousMessages, setQuestionTitle]);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);

  const adjustTextareaHeight = useCallback(
    (el: HTMLTextAreaElement | null, maxPx: number = CHAT_INPUT_MAX_HEIGHT_PX) => {
      if (!el) return;
      el.style.height = "0";
      const capped = Math.min(
        Math.max(el.scrollHeight, CHAT_INPUT_MIN_HEIGHT_PX),
        maxPx
      );
      el.style.height = `${capped}px`;
    },
    []
  );

  const updateExpandButtonVisibility = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setShowExpandButton(h >= CHAT_INPUT_MAX_HEIGHT_PX - 2);
  }, []);

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current);
    requestAnimationFrame(updateExpandButtonVisibility);
  }, [input, adjustTextareaHeight, updateExpandButtonVisibility]);

  useEffect(() => {
    if (isChatExpanded) {
      const el = expandedTextareaRef.current;
      if (el) {
        el.focus();
        requestAnimationFrame(() =>
          adjustTextareaHeight(el, CHAT_INPUT_EXPANDED_MAX_HEIGHT_PX)
        );
      }
    }
  }, [isChatExpanded, input, adjustTextareaHeight]);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    setIsChatExpanded(false);
    if (isAnonymous) {
      anonymousHandoff();
      setInput("");
      return;
    }
    if (sessionId) {
      void Effect.runPromise(
        Effect.either(appendTranscriptApi(sessionId, "user", content))
      ).then((either) =>
        whenRight(either, (entry) => appendEntry(entry))
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

  const isInputEmpty = input.trim() === "";
  const hasMoreHints = Option.match(activeQuestionOpt, {
    onNone: () => false,
    onSome: (q) => hintIndex < q.hints.length,
  });
  const showHintButton = isInputEmpty && hasMoreHints;

  const handleHintClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    whenSome(activeQuestionOpt, (activeQuestion) => {
      if (!hasMoreHints) return;
      const hintMessage = {
        id: generateId(),
        role: "assistant" as const,
        content: activeQuestion.hints[hintIndex],
      };
      setMessages((prev) => [...prev, hintMessage]);
      incrementHint();
    });
  };

  const displayMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: typeof m.content === "string" ? m.content : "",
  }));

  return (
    <div className="relative flex h-full flex-col">
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
        <div className="relative flex min-h-[40px] w-full flex-1 flex-col rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              requestAnimationFrame(() => {
                adjustTextareaHeight(textareaRef.current);
                updateExpandButtonVisibility();
              });
            }}
            onKeyDown={onKeyDown}
            placeholder={isSessionActive ? "Ask your Trainer" : "This interview has ended."}
            rows={1}
            className={cn(
              "min-h-[40px] w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-base text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              "overflow-y-auto",
              showExpandButton ? "pr-10" : "pr-3"
            )}
            style={{ maxHeight: CHAT_INPUT_MAX_HEIGHT_PX }}
            disabled={isLoading || !isSessionActive}
          />
          {showExpandButton && (
            <button
              type="button"
              onClick={() => setIsChatExpanded(true)}
              aria-label="Expand input"
              className="absolute right-2 top-2.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              disabled={isLoading || !isSessionActive}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {showHintButton ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleHintClick}
            disabled={!isSessionActive}
            className="cursor-pointer border-input bg-background text-foreground shadow-sm hover:bg-muted hover:border-muted-foreground/30 hover:shadow active:bg-muted/90"
          >
            <Lightbulb className="h-4 w-4 shrink-0" />
            Hint
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || !isSessionActive}
          >
            {isLoading ? "Sending…" : "Send"}
          </Button>
        )}
      </form>

      {isChatExpanded && (
        <div
          className="absolute inset-0 z-50 flex flex-col rounded-lg border border-border bg-background shadow-lg"
          role="dialog"
          aria-label="Expanded chat input"
        >
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="flex flex-1 flex-col gap-3">
              <div className="relative flex min-h-[40px] w-full flex-1 flex-col rounded-xl border border-input bg-background shadow-lg focus-within:ring-1 focus-within:ring-ring">
                <textarea
                  ref={expandedTextareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    requestAnimationFrame(() =>
                      adjustTextareaHeight(
                        expandedTextareaRef.current,
                        CHAT_INPUT_EXPANDED_MAX_HEIGHT_PX
                      )
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setIsChatExpanded(false);
                      return;
                    }
                    onKeyDown(e);
                  }}
                  placeholder={isSessionActive ? "Ask your Trainer" : "This interview has ended."}
                  rows={1}
                  className={cn(
                    "min-h-[40px] w-full flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 pr-12 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    "overflow-y-auto"
                  )}
                  style={{ maxHeight: CHAT_INPUT_EXPANDED_MAX_HEIGHT_PX }}
                  disabled={isLoading || !isSessionActive}
                />
                <button
                  type="button"
                  onClick={() => setIsChatExpanded(false)}
                  aria-label="Close expanded input"
                  className="absolute right-2 top-2.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex shrink-0 justify-end gap-2">
                {showHintButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      handleHintClick(e);
                    }}
                    disabled={!isSessionActive}
                    className="cursor-pointer border-input bg-background text-foreground shadow-sm hover:bg-muted hover:border-muted-foreground/30 hover:shadow active:bg-muted/90"
                  >
                    <Lightbulb className="h-4 w-4 shrink-0" />
                    Hint
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={isLoading || !input.trim() || !isSessionActive}
                    onClick={() => {
                      setIsChatExpanded(false);
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {isLoading ? "Sending…" : "Send"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
