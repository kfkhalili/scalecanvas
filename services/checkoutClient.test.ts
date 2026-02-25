import { describe, it, expect, vi, afterEach } from "vitest";
import { Effect, Either } from "effect";
import { fetchTokenBalance, initiateCheckout } from "./checkoutClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function runEffect<A, E>(effect: Effect.Effect<A, E>): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect));
}

describe("fetchTokenBalance", () => {
  it("returns token count on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tokens: 7 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchTokenBalance());
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toBe(7);
  });

  it("returns err on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(fetchTokenBalance());
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left.message).toBe("Unauthorized");
  });

  it("returns err on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await runEffect(fetchTokenBalance());
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left.message).toBe("Network error");
  });
});

describe("initiateCheckout", () => {
  it("returns checkout URL on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(initiateCheckout("pack_3"));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result))
      expect(result.right).toBe("https://checkout.stripe.com/test");
  });

  it("returns err on validation error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid pack_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await runEffect(initiateCheckout("bad"));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left.message).toBe("Invalid pack_id");
  });

  it("sends pack_id in request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await Effect.runPromise(Effect.either(initiateCheckout("pack_10")));
    expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_10" }),
    });
  });
});
