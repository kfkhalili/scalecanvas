import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
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
      return Effect.succeed(undefined);
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
    const saveCanvasApi = vi.fn().mockReturnValue(Effect.fail({ message: "Network error" }));
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

  it("sends exact canvas state from getCanvasState to saveCanvasApi (nodes and edges)", async () => {
    const stateWithNodes: CanvasState = {
      nodes: [
        { id: "n1", type: "awsLambda", position: { x: 10, y: 20 }, data: { label: "Lambda" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2", data: {} }],
    };
    const getCanvasState = vi.fn(() => stateWithNodes);
    const saveCanvasApi = vi.fn().mockReturnValue(Effect.succeed(undefined));

    await runBffHandoff({
      sessionId,
      messages: [],
      getCanvasState,
      saveCanvasApi,
      setMessages: vi.fn(),
      persistTranscript: vi.fn().mockResolvedValue(undefined),
      onCanvasSaveError: vi.fn(),
      onHandoffComplete: vi.fn(),
    });

    expect(getCanvasState).toHaveBeenCalled();
    expect(saveCanvasApi).toHaveBeenCalledWith(sessionId, stateWithNodes);
    expect(saveCanvasApi.mock.calls[0][1].nodes).toHaveLength(1);
    expect(saveCanvasApi.mock.calls[0][1].edges).toHaveLength(1);
  });

  it("sends empty canvas when getCanvasState returns no nodes (still persists)", async () => {
    const emptyState: CanvasState = { nodes: [], edges: [] };
    const saveCanvasApi = vi.fn().mockReturnValue(Effect.succeed(undefined));

    await runBffHandoff({
      sessionId,
      messages: [],
      getCanvasState: () => emptyState,
      saveCanvasApi,
      setMessages: vi.fn(),
      persistTranscript: vi.fn().mockResolvedValue(undefined),
      onCanvasSaveError: vi.fn(),
      onHandoffComplete: vi.fn(),
    });

    expect(saveCanvasApi).toHaveBeenCalledWith(sessionId, emptyState);
    expect(saveCanvasApi.mock.calls[0][1].nodes).toHaveLength(0);
    expect(saveCanvasApi.mock.calls[0][1].edges).toHaveLength(0);
  });

  it("does not call onCanvasSaveError when saveCanvasApi returns ok", async () => {
    const saveCanvasApi = vi.fn().mockReturnValue(Effect.succeed(undefined));
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

  describe("transcript entry filtering", () => {
    const makeHandoff = (messages: Parameters<typeof runBffHandoff>[0]["messages"]) => {
      const persistTranscript = vi.fn().mockResolvedValue(undefined);
      return {
        persistTranscript,
        run: () =>
          runBffHandoff({
            sessionId,
            messages,
            getCanvasState: () => canvasState,
            saveCanvasApi: vi.fn().mockReturnValue(Effect.succeed(undefined)),
            setMessages: vi.fn(),
            persistTranscript,
            onCanvasSaveError: vi.fn(),
            onHandoffComplete: vi.fn(),
          }),
      };
    };

    it("excludes messages with empty content from transcript", async () => {
      const { persistTranscript, run } = makeHandoff([
        { id: "u1", role: "user" as const, content: "Hello" },
        { id: "u2", role: "user" as const, content: "" },
        { id: "a1", role: "assistant" as const, content: "World" },
      ]);

      await run();

      // Empty string content excluded; non-empty entries preserved
      expect(persistTranscript).toHaveBeenCalledWith(sessionId, [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "World" },
      ]);
    });

    it("excludes messages with data role from transcript", async () => {
      const { persistTranscript, run } = makeHandoff([
        { id: "u1", role: "user" as const, content: "Describe S3" },
        { id: "d1", role: "data" as const, content: "some-stream-data" },
        { id: "a1", role: "assistant" as const, content: "S3 is object storage" },
      ]);

      await run();

      expect(persistTranscript).toHaveBeenCalledWith(sessionId, [
        { role: "user", content: "Describe S3" },
        { role: "assistant", content: "S3 is object storage" },
      ]);
    });

    it("includes both user and assistant messages when both have content", async () => {
      const { persistTranscript, run } = makeHandoff([
        { id: "u1", role: "user" as const, content: "Question" },
        { id: "a1", role: "assistant" as const, content: "Answer" },
        { id: "u2", role: "user" as const, content: "Follow-up" },
      ]);

      await run();

      expect(persistTranscript).toHaveBeenCalledWith(sessionId, [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
        { role: "user", content: "Follow-up" },
      ]);
    });

    it("calls persistTranscript with empty array when all messages are teaser or empty", async () => {
      const { persistTranscript, run } = makeHandoff([
        { id: "plg-teaser-1", role: "assistant" as const, content: PLG_TEASER_MESSAGE },
        { id: "u1", role: "user" as const, content: "" },
      ]);

      await run();

      expect(persistTranscript).toHaveBeenCalledWith(sessionId, []);
    });
  });

  describe("canvas save retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not call onCanvasSaveError when second save attempt succeeds", async () => {
      let callCount = 0;
      const saveCanvasApi = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? Effect.fail({ message: "transient error" })
          : Effect.succeed(undefined);
      });
      const onCanvasSaveError = vi.fn();

      const handoffPromise = runBffHandoff({
        sessionId,
        messages: [],
        getCanvasState: () => canvasState,
        saveCanvasApi,
        setMessages: vi.fn(),
        persistTranscript: vi.fn().mockResolvedValue(undefined),
        onCanvasSaveError,
        onHandoffComplete: vi.fn(),
      });
      await handoffPromise;

      // Advance past the 400ms retry delay
      await vi.runAllTimersAsync();

      expect(saveCanvasApi).toHaveBeenCalledTimes(2);
      expect(onCanvasSaveError).not.toHaveBeenCalled();
    });

    it("calls onCanvasSaveError exactly once when both save attempts fail", async () => {
      const saveCanvasApi = vi.fn().mockReturnValue(
        Effect.fail({ message: "persistent error" })
      );
      const onCanvasSaveError = vi.fn();

      const handoffPromise = runBffHandoff({
        sessionId,
        messages: [],
        getCanvasState: () => canvasState,
        saveCanvasApi,
        setMessages: vi.fn(),
        persistTranscript: vi.fn().mockResolvedValue(undefined),
        onCanvasSaveError,
        onHandoffComplete: vi.fn(),
      });
      await handoffPromise;
      await vi.runAllTimersAsync();

      expect(saveCanvasApi).toHaveBeenCalledTimes(2);
      expect(onCanvasSaveError).toHaveBeenCalledTimes(1);
    });
  });

  it("setMessages is called with an updater function that ignores prev", async () => {
    const capturedArg: unknown[] = [];
    const setMessages = vi.fn().mockImplementation((arg: unknown) => {
      capturedArg.push(arg);
    });

    await runBffHandoff({
      sessionId,
      messages: [{ id: "u1", role: "user" as const, content: "Hello" }],
      getCanvasState: () => canvasState,
      saveCanvasApi: vi.fn().mockReturnValue(Effect.succeed(undefined)),
      setMessages,
      persistTranscript: vi.fn().mockResolvedValue(undefined),
      onCanvasSaveError: vi.fn(),
      onHandoffComplete: vi.fn(),
    });

    expect(setMessages).toHaveBeenCalledTimes(1);
    // The argument must be an updater function (not a direct array)
    expect(typeof capturedArg[0]).toBe("function");
    // Calling the updater with any prev returns the filtered messages
    const updater = capturedArg[0] as (prev: unknown[]) => unknown[];
    const result = updater([]);
    expect(result).toHaveLength(1);
    expect((result[0] as { id: string }).id).toBe("u1");
  });
});

