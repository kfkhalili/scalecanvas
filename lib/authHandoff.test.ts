import { describe, it, expect, vi } from "vitest";
import { ok, err } from "neverthrow";
import { runBffHandoff } from "./authHandoff";
import { PLG_TEASER_MESSAGE } from "./plg";
import type { CanvasState } from "@/lib/types";

describe("runBffHandoff", () => {
  const sessionId = "session-123";
  const canvasState: CanvasState = {
    nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };
  const messagesWithTeaser = [
    { id: "user-1", role: "user" as const, content: "Hello" },
    { id: "plg-teaser-1", role: "assistant" as const, content: PLG_TEASER_MESSAGE },
  ];

  it("filters teaser, persists transcript, sets messages, then calls onHandoffComplete", async () => {
    const callOrder: string[] = [];
    const saveCanvasApi = vi.fn().mockImplementation(() => {
      callOrder.push("save");
      return Promise.resolve(ok(undefined));
    });
    const setMessages = vi.fn().mockImplementation((fn: (prev: { id: string; content?: string }[]) => { id: string; content?: string }[]) => {
      callOrder.push("setMessages");
      const filtered = fn(messagesWithTeaser);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("user-1");
      expect(filtered[0].content).toBe("Hello");
    });
    const persistTranscript = vi.fn().mockImplementation(async () => {
      callOrder.push("persistTranscript");
    });
    const onHandoffComplete = vi.fn((sid: string, filteredMsgs: { id: string; content?: string }[]) => {
      callOrder.push("onHandoffComplete");
      expect(sid).toBe(sessionId);
      expect(filteredMsgs).toHaveLength(1);
      expect(filteredMsgs[0].content).toBe("Hello");
    });
    const getCanvasState = vi.fn(() => canvasState);
    const onCanvasSaveError = vi.fn();

    await runBffHandoff({
      sessionId,
      messages: messagesWithTeaser,
      getCanvasState,
      saveCanvasApi,
      setMessages,
      persistTranscript,
      onCanvasSaveError,
      onHandoffComplete,
    });

    expect(saveCanvasApi).toHaveBeenCalledWith(sessionId, canvasState);
    expect(persistTranscript).toHaveBeenCalledWith(sessionId, [
      { role: "user", content: "Hello" },
    ]);
    expect(setMessages).toHaveBeenCalled();
    expect(onHandoffComplete).toHaveBeenCalledWith(sessionId, expect.any(Array));
    expect(callOrder).toEqual(["save", "persistTranscript", "setMessages", "onHandoffComplete"]);
    expect(onCanvasSaveError).not.toHaveBeenCalled();
  });

  it("calls onCanvasSaveError when saveCanvasApi returns err", async () => {
    const saveCanvasApi = vi.fn().mockResolvedValue(err({ message: "Network error" }));
    const setMessages = vi.fn();
    const persistTranscript = vi.fn().mockResolvedValue(undefined);
    const onHandoffComplete = vi.fn();
    const onCanvasSaveError = vi.fn();

    await runBffHandoff({
      sessionId,
      messages: messagesWithTeaser,
      getCanvasState: () => canvasState,
      saveCanvasApi,
      setMessages,
      persistTranscript,
      onCanvasSaveError,
      onHandoffComplete,
    });

    await vi.waitFor(() => {
      expect(onCanvasSaveError).toHaveBeenCalledTimes(1);
    });
    expect(setMessages).toHaveBeenCalled();
    expect(persistTranscript).toHaveBeenCalled();
    expect(onHandoffComplete).toHaveBeenCalledWith(sessionId, expect.any(Array));
  });

  it("does not call onCanvasSaveError when saveCanvasApi returns ok", async () => {
    const saveCanvasApi = vi.fn().mockResolvedValue(ok(undefined));
    const onCanvasSaveError = vi.fn();

    await runBffHandoff({
      sessionId,
      messages: [],
      getCanvasState: () => canvasState,
      saveCanvasApi,
      setMessages: vi.fn(),
      persistTranscript: vi.fn().mockResolvedValue(undefined),
      onCanvasSaveError,
      onHandoffComplete: vi.fn(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(onCanvasSaveError).not.toHaveBeenCalled();
  });
});
