"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { parseCanvasState } from "@/lib/canvasParser";
import type { Message } from "ai";

const REVIEW_DEBOUNCE_MS = 10_000;
const MIN_NODES_FOR_REVIEW = 1;

/**
 * Pure logic: should we schedule a debounced review for this canvas snapshot?
 * - First run (lastScheduled === null): do not schedule; record snapshot only.
 * - Unchanged canvas (snapshot === lastScheduled): do not schedule.
 * - Canvas changed: schedule and record new snapshot.
 */
export function getCanvasReviewScheduleDecision(
  snapshot: string,
  lastScheduled: string | null
):
  | { schedule: false; nextLastScheduled: string | null }
  | { schedule: true; nextLastScheduled: string } {
  if (lastScheduled === null) {
    return { schedule: false, nextLastScheduled: snapshot };
  }
  if (snapshot === lastScheduled) {
    return { schedule: false, nextLastScheduled: lastScheduled };
  }
  return { schedule: true, nextLastScheduled: snapshot };
}

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
 * Triggers a debounced Bedrock review only when the canvas (nodes or edges) changes.
 * Does not trigger on initial load or when only chat messages change (e.g. after a review).
 * User messages go through normal chat and already include the diagram in the request.
 */
export function useCanvasReview({
  sessionId,
  messages,
  setMessages,
  isLoading,
}: UseCanvasReviewOpts): void {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const canvasReviewScheduledEnabled = useCanvasStore(
    (s) => s.canvasReviewScheduledEnabled
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReviewedRef = useRef<string>("");
  const lastScheduledSnapshotRef = useRef<string | null>(null);
  const isReviewingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const doReview = useCallback(async () => {
    if (isReviewingRef.current) return;
    const state = useCanvasStore.getState();
    const snapshot = parseCanvasState(state.nodes, state.edges);
    if (snapshot === lastReviewedRef.current) return;
    if (state.nodes.length < MIN_NODES_FOR_REVIEW) return;

    isReviewingRef.current = true;
    lastReviewedRef.current = snapshot;

    try {
      const reviewPrompt =
        "I've updated my architecture diagram. Please briefly review the current state and give me constructive feedback or a follow-up question.";
      const recentMessages = messagesRef.current
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      const chatMessages = [
        ...recentMessages,
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
  }, [setMessages]);

  useEffect(() => {
    if (!canvasReviewScheduledEnabled) return;
    if (isLoading || isReviewingRef.current) return;
    if (nodes.length < MIN_NODES_FOR_REVIEW) return;

    const snapshot = parseCanvasState(nodes, edges);
    const decision = getCanvasReviewScheduleDecision(
      snapshot,
      lastScheduledSnapshotRef.current
    );
    lastScheduledSnapshotRef.current = decision.nextLastScheduled;
    if (!decision.schedule) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      doReview();
    }, REVIEW_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [canvasReviewScheduledEnabled, nodes, edges, isLoading, doReview]);
}
