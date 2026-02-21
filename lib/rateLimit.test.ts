import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rateLimit";

const config = { windowMs: 60_000, maxRequests: 3 };
const NOW = 1_000_000_000_000;

beforeEach(() => {
  resetRateLimitStore();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const r1 = checkRateLimit("user-1", config, NOW);
    expect(r1.isOk()).toBe(true);
    if (r1.isOk()) expect(r1.value.remaining).toBe(2);

    const r2 = checkRateLimit("user-1", config, NOW + 100);
    expect(r2.isOk()).toBe(true);
    if (r2.isOk()) expect(r2.value.remaining).toBe(1);

    const r3 = checkRateLimit("user-1", config, NOW + 200);
    expect(r3.isOk()).toBe(true);
    if (r3.isOk()) expect(r3.value.remaining).toBe(0);
  });

  it("blocks when limit is reached", () => {
    checkRateLimit("user-2", config, NOW);
    checkRateLimit("user-2", config, NOW + 100);
    checkRateLimit("user-2", config, NOW + 200);

    const r4 = checkRateLimit("user-2", config, NOW + 300);
    expect(r4.isErr()).toBe(true);
    if (r4.isErr()) {
      expect(r4.error.allowed).toBe(false);
      expect(r4.error.remaining).toBe(0);
    }
  });

  it("resets after window expires", () => {
    checkRateLimit("user-3", config, NOW);
    checkRateLimit("user-3", config, NOW + 100);
    checkRateLimit("user-3", config, NOW + 200);

    const afterWindow = NOW + 60_001;
    const r = checkRateLimit("user-3", config, afterWindow);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.remaining).toBe(2);
  });

  it("tracks different keys independently", () => {
    checkRateLimit("a", config, NOW);
    checkRateLimit("a", config, NOW);
    checkRateLimit("a", config, NOW);

    const rA = checkRateLimit("a", config, NOW);
    expect(rA.isErr()).toBe(true);

    const rB = checkRateLimit("b", config, NOW);
    expect(rB.isOk()).toBe(true);
  });
});
