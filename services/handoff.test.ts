import { describe, it, expect, vi } from "vitest";
import { claimTrialAndCreateSession } from "./handoff";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

function asClient(
  rpc: (name: string, args: Record<string, string | number | null>) => Promise<{ data: unknown; error: { message?: string } | null }>
): ServerSupabaseClient {
  return { rpc } as unknown as ServerSupabaseClient;
}

describe("claimTrialAndCreateSession", () => {
  it("returns session_id when RPC succeeds", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({ data: "session-abc", error: null })
    );
    const result = await claimTrialAndCreateSession(client, "user-1", "URL Shortener");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("session-abc");
  });

  it("returns err when trial already claimed", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Trial already claimed" },
      })
    );
    const result = await claimTrialAndCreateSession(client, "user-1", null);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Trial already claimed");
  });

  it("returns err when RPC returns non-string data", async () => {
    const client = asClient(
      vi.fn().mockResolvedValue({ data: 123, error: null })
    );
    const result = await claimTrialAndCreateSession(client, "user-1");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("No session_id returned");
  });

  it("passes p_title to RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "sid", error: null });
    const client = asClient(rpc);
    await claimTrialAndCreateSession(client, "user-1", "My Question");
    expect(rpc).toHaveBeenCalledWith("claim_trial_and_create_session", {
      p_title: "My Question",
    });
  });
});
