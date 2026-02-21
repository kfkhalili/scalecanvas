import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTokenBalance, initiateCheckout } from "./checkoutClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchTokenBalance", () => {
  it("returns token count on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tokens: 7 }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    const result = await fetchTokenBalance();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(7);
  });

  it("returns err on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
    );
    const result = await fetchTokenBalance();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Unauthorized");
  });

  it("returns err on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await fetchTokenBalance();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Network error");
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
    const result = await initiateCheckout("pack_3");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("https://checkout.stripe.com/test");
  });

  it("returns err on validation error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid pack_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await initiateCheckout("bad");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Invalid pack_id");
  });

  it("sends pack_id in request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;
    await initiateCheckout("pack_10");
    expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_10" }),
    });
  });
});
