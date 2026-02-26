import { Effect, Either } from "effect";
import { describe, it, expect, vi } from "vitest";
import { checkRateLimit, type RateLimitResult } from "./rateLimit";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const config = { windowMs: 60_000, maxRequests: 3 };

function fakeClient(
  rpcResult: { data: unknown; error: { message?: string } | null }
): ServerSupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as ServerSupabaseClient;
}

async function runCheck(
  client: ServerSupabaseClient,
  key: string,
  cfg = config
) {
  return Effect.runPromise(Effect.either(checkRateLimit(client, key, cfg)));
}

describe("checkRateLimit", () => {
  it("succeeds when RPC returns allowed: true", async () => {
    const client = fakeClient({
      data: { allowed: true, remaining: 2, resetAt: "2026-02-26T12:01:00.000Z" },
      error: null,
    });

    const result = await runCheck(client, "chat:user-1");

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.allowed).toBe(true);
      expect(result.right.remaining).toBe(2);
    }
  });

  it("fails when RPC returns allowed: false (rate limited)", async () => {
    const client = fakeClient({
      data: { allowed: false, remaining: 0, resetAt: "2026-02-26T12:01:00.000Z" },
      error: null,
    });

    const result = await runCheck(client, "chat:user-1");

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.allowed).toBe(false);
      expect(result.left.remaining).toBe(0);
    }
  });

  it("fails when RPC returns a Supabase error", async () => {
    const client = fakeClient({
      data: null,
      error: { message: "function not found" },
    });

    const result = await runCheck(client, "chat:user-1");

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.allowed).toBe(false);
    }
  });

  it("passes correct args to the RPC", async () => {
    const client = fakeClient({
      data: { allowed: true, remaining: 19, resetAt: "2026-02-26T12:01:00.000Z" },
      error: null,
    });

    await runCheck(client, "chat:user-42", { windowMs: 30_000, maxRequests: 10 });

    const rpcFn = (client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpcFn).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "chat:user-42",
      p_window_ms: 30_000,
      p_max: 10,
    });
  });
});
