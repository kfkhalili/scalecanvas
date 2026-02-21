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

  it("calls saveCanvasApi first with sessionId and state, then setMessages with teaser filtered, then reload", () => {
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
    const reload = vi.fn(() => callOrder.push("reload"));
    const getCanvasState = vi.fn(() => canvasState);
    const onCanvasSaveError = vi.fn();

    runBffHandoff({
      sessionId,
      getCanvasState,
      saveCanvasApi,
      setMessages,
      reload,
      onCanvasSaveError,
    });

    expect(saveCanvasApi).toHaveBeenCalledWith(sessionId, canvasState);
    expect(setMessages).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(callOrder).toEqual(["save", "setMessages", "reload"]);
    expect(onCanvasSaveError).not.toHaveBeenCalled();
  });

  it("calls onCanvasSaveError when saveCanvasApi returns err", async () => {
    const saveCanvasApi = vi.fn().mockResolvedValue(err({ message: "Network error" }));
    const setMessages = vi.fn();
    const reload = vi.fn();
    const onCanvasSaveError = vi.fn();

    runBffHandoff({
      sessionId,
      getCanvasState: () => canvasState,
      saveCanvasApi,
      setMessages,
      reload,
      onCanvasSaveError,
    });

    await vi.waitFor(() => {
      expect(onCanvasSaveError).toHaveBeenCalledTimes(1);
    });
    expect(setMessages).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("does not call onCanvasSaveError when saveCanvasApi returns ok", async () => {
    const saveCanvasApi = vi.fn().mockResolvedValue(ok(undefined));
    const onCanvasSaveError = vi.fn();

    runBffHandoff({
      sessionId,
      getCanvasState: () => canvasState,
      saveCanvasApi,
      setMessages: vi.fn(),
      reload: vi.fn(),
      onCanvasSaveError,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(onCanvasSaveError).not.toHaveBeenCalled();
  });
});
