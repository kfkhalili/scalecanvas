import { Effect, Option, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type TokenError = { message: string };

export function getTokenBalance(
  client: ServerSupabaseClient,
  userId: string
): Effect.Effect<number, TokenError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        client.from("profiles").select("tokens").eq("id", userId).single(),
      catch: (e) => ({ message: e instanceof Error ? e.message : String(e) }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail({ message: error.message })
        : data == null
          ? Effect.fail({ message: "Profile not found" })
          : Effect.succeed((data as { tokens: number }).tokens)
    )
  );
}

export function getOrCreateStripeCustomerId(
  client: ServerSupabaseClient,
  userId: string
): Effect.Effect<Option.Option<string>, TokenError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        client
          .from("stripe_customers")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle(),
      catch: (e) => ({ message: e instanceof Error ? e.message : String(e) }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail({ message: error.message })
        : Effect.succeed(
            data == null
              ? Option.none()
              : Option.some(
                  (data as { stripe_customer_id: string }).stripe_customer_id
                )
          )
    )
  );
}

export function saveStripeCustomerId(
  client: ServerSupabaseClient,
  userId: string,
  stripeCustomerId: string
): Effect.Effect<void, TokenError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        client
          .from("stripe_customers")
          .insert({
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
          } as never),
      catch: (e) => ({ message: e instanceof Error ? e.message : String(e) }),
    }),
    Effect.flatMap(({ error }) =>
      error
        ? Effect.fail({ message: error.message })
        : Effect.succeed(undefined)
    )
  );
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | number>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function creditTokensForPurchase(
  client: ServerSupabaseClient,
  userId: string,
  stripeSessionId: string,
  packId: string,
  tokens: number
): Effect.Effect<number, TokenError> {
  const rpcClient = client as unknown as RpcClient;
  return pipe(
    Effect.tryPromise({
      try: () =>
        rpcClient.rpc("credit_tokens_for_purchase", {
          p_user_id: userId,
          p_stripe_session_id: stripeSessionId,
          p_pack_id: packId,
          p_tokens: tokens,
        }),
      catch: (e) => ({ message: e instanceof Error ? e.message : String(e) }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail({ message: error.message ?? "Token credit failed" })
        : data != null && typeof data === "number"
          ? Effect.succeed(data)
          : Effect.fail({
              message: "Unexpected response from credit_tokens_for_purchase",
            })
    )
  );
}
