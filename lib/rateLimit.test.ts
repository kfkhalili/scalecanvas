import { Effect, Either } from "effect";
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rateLimit";

const config = { windowMs: 60_000, maxRequests: 3 };
const NOW = 1_000_000_000_000;

function runCheck(
  key: string,
  cfg: { windowMs: number; maxRequests: number },
  now: number
) {
  return Effect.runSync(Effect.either(checkRateLimit(key, cfg, now)));
}

beforeEach(() => {
  resetRateLimitStore();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const r1 = runCheck("user-1", config, NOW);
    expect(Either.isRight(r1)).toBe(true);
    if (Either.isRight(r1)) expect(r1.right.remaining).toBe(2);

    const r2 = runCheck("user-1", config, NOW + 100);
    expect(Either.isRight(r2)).toBe(true);
    if (Either.isRight(r2)) expect(r2.right.remaining).toBe(1);

    const r3 = runCheck("user-1", config, NOW + 200);
    expect(Either.isRight(r3)).toBe(true);
    if (Either.isRight(r3)) expect(r3.right.remaining).toBe(0);
  });

  it("blocks when limit is reached", () => {
    runCheck("user-2", config, NOW);
    runCheck("user-2", config, NOW + 100);
    runCheck("user-2", config, NOW + 200);

    const r4 = runCheck("user-2", config, NOW + 300);
    expect(Either.isLeft(r4)).toBe(true);
    if (Either.isLeft(r4)) {
      expect(r4.left.allowed).toBe(false);
      expect(r4.left.remaining).toBe(0);
    }
  });

  it("resets after window expires", () => {
    runCheck("user-3", config, NOW);
    runCheck("user-3", config, NOW + 100);
    runCheck("user-3", config, NOW + 200);

    const afterWindow = NOW + 60_001;
    const r = runCheck("user-3", config, afterWindow);
    expect(Either.isRight(r)).toBe(true);
    if (Either.isRight(r)) expect(r.right.remaining).toBe(2);
  });

  it("tracks different keys independently", () => {
    runCheck("a", config, NOW);
    runCheck("a", config, NOW);
    runCheck("a", config, NOW);

    const rA = runCheck("a", config, NOW);
    expect(Either.isLeft(rA)).toBe(true);

    const rB = runCheck("b", config, NOW);
    expect(Either.isRight(rB)).toBe(true);
  });
});
