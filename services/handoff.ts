import { Effect, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type HandoffError = { message: string };

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | number | null>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Claims the one-time trial and creates a session when eligible (trial_claimed_at is null).
 * Does not deduct tokens. Returns err when trial already claimed or not authenticated.
 */
export function claimTrialAndCreateSession(
  client: ServerSupabaseClient,
  _userId: string,
  title?: string | null
): Effect.Effect<string, HandoffError> {
  const rpcClient = client as unknown as RpcClient;
  return pipe(
    Effect.tryPromise({
      try: () =>
        rpcClient.rpc("claim_trial_and_create_session", {
          p_title: title ?? null,
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : String(e),
      }),
    }),
    Effect.flatMap(({ data, error }) => {
      if (error) {
        return Effect.fail({
          message: error.message ?? "Trial claim failed",
        });
      }
      if (data == null || typeof data !== "string") {
        return Effect.fail({ message: "No session_id returned" });
      }
      return Effect.succeed(data);
    })
  );
}
