"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import type { Message } from "ai";

const REVIEW_DEBOUNCE_MS = 8_000;
const MIN_NODES_FOR_REVIEW = 1;

async function readStreamText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (line.startsWith("0:")) {
        try {
          result += JSON.parse(line.slice(2)) as string;
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
  return result;
}

type UseCanvasReviewOpts = {
  sessionId?: string;
  messages: Message[];
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  isLoading: boolean;
};

/**
 * Watches canvas changes and triggers a debounced Bedrock review.
 * The review appears as a Trainer message in the chat.
 */
export function useCanvasReview({
  sessionId,
  messages,
  setMessages,
  isLoading,
}: UseCanvasReviewOpts): void {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReviewedRef = useRef<string>("");
  const isReviewingRef = useRef(false);

  const doReview = useCallback(async () => {
    if (isReviewingRef.current) return;
    const state = useCanvasStore.getState();
    const snapshot = JSON.stringify({ nodes: state.nodes, edges: state.edges });
    if (snapshot === lastReviewedRef.current) return;
    if (state.nodes.length < MIN_NODES_FOR_REVIEW) return;

    isReviewingRef.current = true;
    lastReviewedRef.current = snapshot;

    try {
      const reviewPrompt =
        "I've updated my architecture diagram. Please briefly review the current state and give me constructive feedback or a follow-up question.";
      const chatMessages = [
        ...messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: reviewPrompt },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          nodes: state.nodes,
          edges: state.edges,
        }),
      });

      if (!res.ok) return;

      const text = await readStreamText(res);
      if (!text.trim()) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `review-${Date.now()}`,
          role: "assistant",
          content: text.trim(),
        },
      ]);
    } catch {
      // silently ignore review failures
    } finally {
      isReviewingRef.current = false;
    }
  }, [messages, setMessages]);

  useEffect(() => {
    if (isLoading || isReviewingRef.current) return;
    if (nodes.length < MIN_NODES_FOR_REVIEW) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      doReview();
    }, REVIEW_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, isLoading, doReview]);
}
