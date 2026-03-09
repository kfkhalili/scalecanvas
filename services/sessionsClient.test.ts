import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either } from "effect";
import { saveCanvasApi } from "./sessionsClient";
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
