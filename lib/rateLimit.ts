import { Effect, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

type RateLimitConfig = {
  readonly windowMs: number;
  readonly maxRequests: number;
};

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: string;
};

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | number>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Atomically check-and-increment a rate-limit bucket in Supabase.
 *
 * Returns `Effect.succeed` when the request is allowed and
 * `Effect.fail` (with the same shape) when the caller is rate-limited.
 */
export function checkRateLimit(
  client: ServerSupabaseClient,
  key: string,
  config: RateLimitConfig
): Effect.Effect<RateLimitResult, RateLimitResult> {
  const rpcClient = client as unknown as RpcClient;
  return pipe(
    Effect.tryPromise({
      try: () =>
        rpcClient.rpc("check_rate_limit", {
          p_key: key,
          p_window_ms: config.windowMs,
          p_max: config.maxRequests,
        }),
      catch: (e) => ({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + config.windowMs).toISOString(),
        _rpcError: e instanceof Error ? e.message : String(e),
      }),
    }),
    Effect.flatMap(({ data, error }) => {
      if (error) {
        return Effect.fail({
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + config.windowMs).toISOString(),
        } as RateLimitResult);
      }
      const result = data as RateLimitResult;
      if (result.allowed) {
        return Effect.succeed(result);
      }
      return Effect.fail(result);
    })
  );
}

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 20,
};
