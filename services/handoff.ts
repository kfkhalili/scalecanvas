import { ok, err, type Result } from "neverthrow";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

type HandoffError = { message: string };

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
export async function claimTrialAndCreateSession(
  client: ServerSupabaseClient,
  _userId: string,
  title?: string | null
): Promise<Result<string, HandoffError>> {
  const rpcClient = client as unknown as RpcClient;
  try {
    const { data, error } = await rpcClient.rpc("claim_trial_and_create_session", {
      p_title: title ?? null,
    });
    if (error) {
      return err({ message: error.message ?? "Trial claim failed" });
    }
    if (data == null || typeof data !== "string") {
      return err({ message: "No session_id returned" });
    }
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ message });
  }
}
