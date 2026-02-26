import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either, Option } from "effect";
import {
  fetchNodeLibraryProviders,
  saveNodeLibraryProviders,
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

describe("fetchNodeLibraryProviders", () => {
  it("returns Option.some([\"aws\",\"gcp\"]) when GET returns { providers: [\"aws\",\"gcp\"] }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ providers: ["aws", "gcp"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProviders());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(Option.isSome(result.right)).toBe(true);
      expect(Option.getOrNull(result.right)).toEqual(["aws", "gcp"]);
    }
  });

  it("returns Option.some([]) when GET returns {} or { providers: [] }", async () => {
    const emptyPayloads = [{}, { providers: [] }];
    for (const payload of emptyPayloads) {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      const result = await runEffect(fetchNodeLibraryProviders());
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(Option.isSome(result.right)).toBe(true);
        expect(Option.getOrNull(result.right)).toEqual([]);
      }
    }
  });

  it("returns Option.some([]) when payload is invalid or missing providers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ providers: ["bogus"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProviders());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(Option.isSome(result.right)).toBe(true);
      expect(Option.getOrNull(result.right)).toEqual([]);
    }
  });

  it("returns ApiError on 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchNodeLibraryProviders());
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toBe("Unauthorized");
    }
  });
});

describe("saveNodeLibraryProviders", () => {
  it("returns { ok: true } on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(saveNodeLibraryProviders(["gcp"]));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toEqual({ ok: true });
  });

  it("calls PATCH with body JSON.stringify({ providers: [\"aws\"] }) or [\"aws\",\"gcp\"]", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await runEffect(saveNodeLibraryProviders(["aws", "gcp"]));
    expect(mockFetch).toHaveBeenCalledWith("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providers: ["aws", "gcp"] }),
      credentials: "include",
    });
  });

  it("returns ApiError on 400 (message can reference providers array validation)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "providers must be an array of valid providers",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await runEffect(saveNodeLibraryProviders(["aws"]));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toContain("providers");
    }
  });
});
