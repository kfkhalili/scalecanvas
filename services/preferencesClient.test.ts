import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either, Option } from "effect";
import {
  fetchNodeLibraryProvider,
  saveNodeLibraryProvider,
} from "./preferencesClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function runEffect<A, E>(
  effect: Effect.Effect<A, E>
): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect));
}

describe("fetchNodeLibraryProvider", () => {
  it("returns Option.some(provider) when backend has a valid preference", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ provider: "aws" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProvider());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(Option.isSome(result.right)).toBe(true);
      expect(Option.getOrNull(result.right)).toBe("aws");
    }
  });

  it("returns Option.none() when provider is null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ provider: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProvider());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(Option.isNone(result.right)).toBe(true);
    }
  });

  it("returns Option.none() when provider is an invalid string", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ provider: "bogus" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProvider());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(Option.isNone(result.right)).toBe(true);
    }
  });

  it("returns ApiError on 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProvider());
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toBe("Unauthorized");
    }
  });
});

describe("saveNodeLibraryProvider", () => {
  it("returns ok on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(saveNodeLibraryProvider("gcp"));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toEqual({ ok: true });
  });

  it("sends provider in PATCH body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await runEffect(saveNodeLibraryProvider("azure"));
    expect(mockFetch).toHaveBeenCalledWith("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "azure" }),
      credentials: "include",
    });
  });

  it("returns ApiError on 400", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "provider must be one of: all, aws, gcp, azure, generic",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await runEffect(saveNodeLibraryProvider("all"));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toContain("provider must be one of");
    }
  });
});
