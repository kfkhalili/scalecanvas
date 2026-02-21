import { describe, it, expect } from "vitest";
import { getPackById, TOKEN_PACKS } from "./stripe";

describe("stripe token packs", () => {
  it("has 3 packs defined", () => {
    expect(TOKEN_PACKS).toHaveLength(3);
  });

  it("getPackById returns correct pack", () => {
    const pack = getPackById("pack_5");
    expect(pack).toBeDefined();
    expect(pack?.tokens).toBe(5);
    expect(pack?.label).toBe("5 Interviews");
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
});
