import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either } from "effect";
import { postHandoff } from "./handoffClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function runEffect<A, E>(
  effect: Effect.Effect<A, E>
): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect));
}

describe("postHandoff", () => {
  it("returns created true and session_id on 201", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: true, session_id: "session-xyz" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(postHandoff("URL Shortener"));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual({ created: true, session_id: "session-xyz" });
    }
  });

  it("returns created false on 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(postHandoff(null));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toEqual({ created: false });
  });

  it("returns err on 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(postHandoff());
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left.message).toBe("Unauthorized");
  });

  it("sends question_title in body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await Effect.runPromise(Effect.either(postHandoff("My Question")));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/handoff",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question_title: "My Question" }),
      })
    );
  });
});
