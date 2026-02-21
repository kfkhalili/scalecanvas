import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";

type RateLimitEntry = {
  readonly count: number;
  readonly resetAt: number;
};

type RateLimitConfig = {
  readonly windowMs: number;
  readonly maxRequests: number;
};

type RateLimitResult = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function pruneExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now()
): Result<RateLimitResult, RateLimitResult> {
  if (store.size > 10_000) {
    pruneExpired(now);
  }

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, entry);
    return ok({
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
    });
  }

  if (existing.count >= config.maxRequests) {
    return err({
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    });
  }

  const updated: RateLimitEntry = {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  };
  store.set(key, updated);
  return ok({
    allowed: true,
    remaining: config.maxRequests - updated.count,
    resetAt: updated.resetAt,
  });
}

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 20,
};

export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
};

/** Reset all entries (for testing). */
export function resetRateLimitStore(): void {
  store.clear();
}
