import { Effect, Either } from "effect";
import { describe, it, expect, vi } from "vitest";
import { deductTokenAndCreateSession } from "./tokensClient";

type SupabaseRpc = Parameters<typeof deductTokenAndCreateSession>[0];

function runEffect<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.runPromise(Effect.either(effect));
}

describe("deductTokenAndCreateSession", () => {
  it("returns session_id when RPC returns data", async () => {
    const sessionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const supabase: SupabaseRpc = {
      rpc: vi.fn().mockResolvedValue({ data: sessionId, error: null }),
    };

    const either = await runEffect(deductTokenAndCreateSession(supabase));

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right).toBe(sessionId);
    }
    expect(supabase.rpc).toHaveBeenCalledWith("deduct_token_and_create_session");
  });

  it("returns err when RPC returns error (e.g. insufficient tokens)", async () => {
    const supabase: SupabaseRpc = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Insufficient tokens" },
      }),
    };

    const either = await runEffect(deductTokenAndCreateSession(supabase));

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect(either.left.message).toBe("Insufficient tokens");
    }
  });

  it("returns err when RPC throws", async () => {
    const supabase: SupabaseRpc = {
      rpc: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const either = await runEffect(deductTokenAndCreateSession(supabase));

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect(either.left.message).toContain("Network error");
    }
  });
});
