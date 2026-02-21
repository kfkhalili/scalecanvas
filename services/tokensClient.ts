import { ok, err, type Result } from "neverthrow";

export type TokenError = { message: string };

type SupabaseRpcClient = {
  rpc: (
    name: string
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Calls the Supabase RPC deduct_token_and_create_session. If the user has
 * tokens > 0, decrements one and creates a session; returns the new session_id.
 * Otherwise returns err (e.g. insufficient tokens). Uses Result for strict FP.
 */
export async function deductTokenAndCreateSession(
  supabase: SupabaseRpcClient
): Promise<Result<string, TokenError>> {
  try {
    const { data, error } = await supabase.rpc("deduct_token_and_create_session");
    if (error) {
      return err({ message: error.message ?? "Token deduction failed" });
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
