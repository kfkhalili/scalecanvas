import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either } from "effect";
import { saveCanvasApi, appendTranscriptBatchApi } from "./sessionsClient";
import type { CanvasState } from "@/lib/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("saveCanvasApi", () => {
  const sessionId = "session-123";
  const canvasState: CanvasState = {
    nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };

  it("sends PUT request with keepalive: true so navigation cannot abort an in-flight save", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    await Effect.runPromise(saveCanvasApi(sessionId, canvasState));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/sessions/${sessionId}/canvas`),
      expect.objectContaining({ method: "PUT", keepalive: true })
    );
  });

  it("sends the canvas state as JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    await Effect.runPromise(saveCanvasApi(sessionId, canvasState));

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(options.body as string)).toEqual(canvasState);
  });

  it("returns a fail Effect on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      json: vi.fn().mockResolvedValue({ error: "Not authorized" }),
    });

    const result = await Effect.runPromise(
      Effect.either(saveCanvasApi(sessionId, canvasState))
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toBe("Not authorized");
    }
  });
});

describe("appendTranscriptBatchApi", () => {
  const sessionId = "sess-123";
  const entries = [
    { id: "msg-1", role: "user" as const, content: "Hello" },
    { id: "msg-2", role: "assistant" as const, content: "Hi" },
  ];

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to the batch transcript endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 2 }),
    });

    await Effect.runPromise(appendTranscriptBatchApi(sessionId, entries));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/sessions/${sessionId}/transcript/batch`),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends entries as JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 2 }),
    });

    await Effect.runPromise(appendTranscriptBatchApi(sessionId, entries));

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(options.body as string)).toEqual({ entries });
  });

  it("maps a successful {count} response to undefined", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 2 }),
    });

    const result = await Effect.runPromise(
      Effect.either(appendTranscriptBatchApi(sessionId, entries))
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBeUndefined();
    }
  });

  it("returns a fail Effect on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Unprocessable Entity",
      json: vi.fn().mockResolvedValue({ error: "Batch too large" }),
    });

    const result = await Effect.runPromise(
      Effect.either(appendTranscriptBatchApi(sessionId, entries))
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toBe("Batch too large");
    }
  });
});
