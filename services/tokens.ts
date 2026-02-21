import { ok, err, type Result } from "neverthrow";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

type TokenError = { message: string };

export async function getTokenBalance(
  client: ServerSupabaseClient,
  userId: string
): Promise<Result<number, TokenError>> {
  const { data, error } = await client
    .from("profiles")
    .select("tokens")
    .eq("id", userId)
    .single();
  if (error) return err({ message: error.message });
  if (!data) return err({ message: "Profile not found" });
  return ok((data as { tokens: number }).tokens);
}

export async function getOrCreateStripeCustomerId(
  client: ServerSupabaseClient,
  userId: string
): Promise<Result<string | null, TokenError>> {
  const { data, error } = await client
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return err({ message: error.message });
  if (!data) return ok(null);
  return ok((data as { stripe_customer_id: string }).stripe_customer_id);
}

export async function saveStripeCustomerId(
  client: ServerSupabaseClient,
  userId: string,
  stripeCustomerId: string
): Promise<Result<undefined, TokenError>> {
  const { error } = await client
    .from("stripe_customers")
    .insert({ user_id: userId, stripe_customer_id: stripeCustomerId } as never);
  if (error) return err({ message: error.message });
  return ok(undefined);
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | number>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export async function creditTokensForPurchase(
  client: ServerSupabaseClient,
  userId: string,
  stripeSessionId: string,
  packId: string,
  tokens: number
): Promise<Result<number, TokenError>> {
  const rpcClient = client as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc("credit_tokens_for_purchase", {
    p_user_id: userId,
    p_stripe_session_id: stripeSessionId,
    p_pack_id: packId,
    p_tokens: tokens,
  });
  if (error) return err({ message: error.message ?? "Token credit failed" });
  if (data == null || typeof data !== "number") {
    return err({ message: "Unexpected response from credit_tokens_for_purchase" });
  }
  return ok(data);
}
