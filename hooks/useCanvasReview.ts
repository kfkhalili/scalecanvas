"use client";

import { useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { parseCanvasState } from "@/lib/canvasParser";
import type { Message } from "ai";

const MIN_NODES_FOR_REVIEW = 1;

/**
 * Pure: should the Evaluate button be enabled?
 * Enabled when there are enough nodes, semantic canvas changed since last evaluation, and not loading/evaluating.
 */
export function canEvaluateFromSnapshot(
  currentSnapshot: string,
  lastEvaluatedSnapshot: string | null,
  hasEnoughNodes: boolean,
  isEvaluating: boolean,
  isLoading: boolean
): boolean {
  if (!hasEnoughNodes || isEvaluating || isLoading) return false;
  if (lastEvaluatedSnapshot === null) return true;
  return currentSnapshot !== lastEvaluatedSnapshot;
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
  messages: Message[];
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  isLoading: boolean;
  /** Required for authenticated users so the chat API can validate session and time limit. */
  sessionId?: string | null;
};

/**
 * Manual canvas evaluation: user clicks "Evaluate" to request feedback on the diagram.
 * Returns evaluate(), canEvaluate (true when semantic canvas changed since last evaluation),
 * and isEvaluating. Node/edge IDs and coordinates do not affect canEvaluate.
 */
export function useCanvasReview({
  messages,
  setMessages,
  isLoading,
  sessionId,
}: UseCanvasReviewOpts): {
  evaluate: () => void;
  canEvaluate: boolean;
  isEvaluating: boolean;
} {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const lastEvaluatedSnapshotRef = useRef<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const currentSnapshot = parseCanvasState(nodes, edges);
  const hasEnoughNodes = nodes.length >= MIN_NODES_FOR_REVIEW;
  const canEvaluate = canEvaluateFromSnapshot(
    currentSnapshot,
    lastEvaluatedSnapshotRef.current,
    hasEnoughNodes,
    isEvaluating,
    isLoading
  );

  const evaluate = useCallback(async () => {
    if (isEvaluating || isLoading) return;
    const state = useCanvasStore.getState();
    const snapshot = parseCanvasState(state.nodes, state.edges);
    if (snapshot === lastEvaluatedSnapshotRef.current) return;
    if (state.nodes.length < MIN_NODES_FOR_REVIEW) return;

    setIsEvaluating(true);

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

      const body: Record<string, unknown> = {
        messages: chatMessages,
        nodes: state.nodes,
        edges: state.edges,
      };
      if (sessionId) body.session_id = sessionId;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setIsEvaluating(false);
        return;
      }

      const text = await readStreamText(res);
      if (text.trim()) {
        lastEvaluatedSnapshotRef.current = snapshot;
        setMessages((prev) => [
          ...prev,
          {
            id: `review-${Date.now()}`,
            role: "assistant",
            content: text.trim(),
          },
        ]);
      }
    } catch {
      // silently ignore review failures
    } finally {
      setIsEvaluating(false);
    }
  }, [setMessages, isLoading, isEvaluating, sessionId]);

  return { evaluate, canEvaluate, isEvaluating };
}
