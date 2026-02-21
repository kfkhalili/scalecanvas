import { describe, it, expect, vi } from "vitest";
import { deductTokenAndCreateSession } from "./tokensClient";

describe("deductTokenAndCreateSession", () => {
  it("returns ok(session_id) when RPC returns data", async () => {
    const sessionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: sessionId, error: null }),
    } as unknown as Parameters<typeof deductTokenAndCreateSession>[0];

    const result = await deductTokenAndCreateSession(supabase);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(sessionId);
    }
    expect(supabase.rpc).toHaveBeenCalledWith("deduct_token_and_create_session");
  });

  it("returns err when RPC returns error (e.g. insufficient tokens)", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Insufficient tokens" },
      }),
    } as unknown as Parameters<typeof deductTokenAndCreateSession>[0];

    const result = await deductTokenAndCreateSession(supabase);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Insufficient tokens");
    }
  });

  it("returns err when RPC throws", async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as Parameters<typeof deductTokenAndCreateSession>[0];

    const result = await deductTokenAndCreateSession(supabase);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Network error");
    }
  });
});
