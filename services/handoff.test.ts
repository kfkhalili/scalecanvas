import { describe, it, expect, vi } from "vitest";
import { Effect, Either } from "effect";
import { claimTrialAndCreateSession } from "./handoff";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

function asClient(
  rpc: (
    name: string,
    args: Record<string, string | number | null>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
): ServerSupabaseClient {
  return { rpc } as unknown as ServerSupabaseClient;
}

async function runEffect<A, E>(
  effect: Effect.Effect<A, E>
): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect));
}

describe("claimTrialAndCreateSession", () => {
  it("returns session_id when RPC succeeds", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({ data: "session-abc", error: null })
    );
    const result = await runEffect(
      claimTrialAndCreateSession(client, "user-1", "URL Shortener")
    );
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toBe("session-abc");
  });

  it("returns err when trial already claimed", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Trial already claimed" },
      })
    );
    const result = await runEffect(
      claimTrialAndCreateSession(client, "user-1", null)
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result))
      expect(result.left.message).toBe("Trial already claimed");
  });

  it("returns err when RPC returns non-string data", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({ data: 123, error: null })
    );
    const result = await runEffect(claimTrialAndCreateSession(client, "user-1"));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result))
      expect(result.left.message).toBe("No session_id returned");
  });

  it("passes p_title to RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "sid", error: null });
    const client = asClient(rpc);
    await Effect.runPromise(
      Effect.either(claimTrialAndCreateSession(client, "user-1", "My Question"))
    );
    expect(rpc).toHaveBeenCalledWith("claim_trial_and_create_session", {
      p_title: "My Question",
    });
  });
});
