import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcriptEntryToMessage, fetchWithGuardrail } from "./chatHelpers";
import type { TranscriptEntry } from "@/lib/types";

describe("transcriptEntryToMessage", () => {
  it("maps a TranscriptEntry to a message object", () => {
    const entry: TranscriptEntry = {
      id: "t-1",
      sessionId: "s-1",
      role: "user",
      content: "Hello",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const msg = transcriptEntryToMessage(entry);
    expect(msg).toEqual({ id: "t-1", role: "user", content: "Hello" });
  });

  it("maps assistant entries", () => {
    const entry: TranscriptEntry = {
      id: "t-2",
      sessionId: "s-1",
      role: "assistant",
      content: "Hi there",
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(transcriptEntryToMessage(entry).role).toBe("assistant");
  });

  it("does not include sessionId or createdAt", () => {
    const entry: TranscriptEntry = {
      id: "t-3",
      sessionId: "s-1",
      role: "user",
      content: "Test",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const msg = transcriptEntryToMessage(entry);
    expect(Object.keys(msg)).toEqual(["id", "role", "content"]);
  });
});

describe("fetchWithGuardrail", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns response for 200 status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchWithGuardrail("http://test.com");
    expect(res.status).toBe(200);
  });

  it("throws on 401 with statusCode property", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    try {
      await fetchWithGuardrail("http://test.com");
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as Error & { statusCode: number };
      expect(err.message).toBe("Auth failed");
      expect(err.statusCode).toBe(401);
    }
  });

  it("throws on 403 with default message when body is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("not json", { status: 403 })
    );
    try {
      await fetchWithGuardrail("http://test.com");
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as Error & { statusCode: number };
      expect(err.message).toBe("Interview time has expired.");
      expect(err.statusCode).toBe(403);
    }
  });

  it("passes through non-auth error statuses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    const res = await fetchWithGuardrail("http://test.com");
    expect(res.status).toBe(500);
  });
});
