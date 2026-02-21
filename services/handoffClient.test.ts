import { describe, it, expect, vi, afterEach } from "vitest";
import { postHandoff } from "./handoffClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("postHandoff", () => {
  it("returns created true and session_id on 201", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: true, session_id: "session-xyz" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await postHandoff("URL Shortener");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ created: true, session_id: "session-xyz" });
    }
  });

  it("returns created false on 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await postHandoff(null);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual({ created: false });
  });

  it("returns err on 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await postHandoff();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Unauthorized");
  });

  it("sends question_title in body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await postHandoff("My Question");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/handoff",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question_title: "My Question" }),
      })
    );
  });
});
