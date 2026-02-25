import { Effect, pipe } from "effect";

export type TokenError = { message: string };

type SupabaseRpcClient = {
  rpc: (
    name: string
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Calls the Supabase RPC deduct_token_and_create_session. If the user has
 * tokens > 0, decrements one and creates a session; returns the new session_id.
 * Otherwise fails with TokenError (e.g. insufficient tokens).
 */
export function deductTokenAndCreateSession(
  supabase: SupabaseRpcClient
): Effect.Effect<string, TokenError> {
  return pipe(
    Effect.tryPromise({
      try: () => supabase.rpc("deduct_token_and_create_session"),
      catch: (e) => ({
        message: e instanceof Error ? e.message : String(e),
      }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail({ message: error.message ?? "Token deduction failed" })
        : typeof data === "string"
          ? Effect.succeed(data)
          : Effect.fail({ message: "No session_id returned" })
    )
  );
}
