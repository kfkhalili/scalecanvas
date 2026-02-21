import { describe, it, expect, vi, afterEach } from "vitest";
import { getPackById, getStripePriceId, TOKEN_PACKS } from "./stripe";

describe("stripe token packs", () => {
  it("has 3 packs defined", () => {
    expect(TOKEN_PACKS).toHaveLength(3);
  });

  it("getPackById returns correct pack", () => {
    const pack = getPackById("pack_3");
    expect(pack).toBeDefined();
    expect(pack?.tokens).toBe(3);
    expect(pack?.label).toBe("3 Interviews");
  });

  it("getPackById returns undefined for unknown pack", () => {
    expect(getPackById("unknown")).toBeUndefined();
  });

  it("each pack has a unique id", () => {
    const ids = TOKEN_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each pack has positive token count", () => {
    for (const pack of TOKEN_PACKS) {
      expect(pack.tokens).toBeGreaterThan(0);
    }
  });

  it("each pack has a positive USD price", () => {
    for (const pack of TOKEN_PACKS) {
      expect(pack.priceUsd).toBeGreaterThan(0);
    }
  });

  it("per-session price decreases with volume", () => {
    const perSession = TOKEN_PACKS.map((p) => p.priceUsd / p.tokens);
    for (let i = 1; i < perSession.length; i++) {
      expect(perSession[i]).toBeLessThan(perSession[i - 1]);
    }
  });
});

describe("getStripePriceId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the env var value when set", () => {
    vi.stubEnv("STRIPE_PRICE_ID_3", "price_test_123");
    const pack = getPackById("pack_3");
    expect(pack).toBeDefined();
    expect(getStripePriceId(pack!)).toBe("price_test_123");
  });

  it("returns undefined when env var is not set", () => {
    delete process.env.STRIPE_PRICE_ID_3;
    const pack = getPackById("pack_3");
    expect(pack).toBeDefined();
    expect(getStripePriceId(pack!)).toBeUndefined();
  });
});
