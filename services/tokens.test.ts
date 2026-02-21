import { describe, it, expect, vi } from "vitest";
import {
  getTokenBalance,
  getOrCreateStripeCustomerId,
  saveStripeCustomerId,
  creditTokensForPurchase,
} from "./tokens";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

function asClient(mock: Record<string, unknown>): ServerSupabaseClient {
  return mock as unknown as ServerSupabaseClient;
}

describe("getTokenBalance", () => {
  it("returns token count on success", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { tokens: 10 },
              error: null,
            }),
          }),
        }),
      }),
    });
    const result = await getTokenBalance(client, "user-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(10);
  });

  it("returns err on query error", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "DB error" },
            }),
          }),
        }),
      }),
    });
    const result = await getTokenBalance(client, "user-1");
    expect(result.isErr()).toBe(true);
  });
});

describe("getOrCreateStripeCustomerId", () => {
  it("returns existing stripe customer id", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { stripe_customer_id: "cus_abc" },
              error: null,
            }),
          }),
        }),
      }),
    });
    const result = await getOrCreateStripeCustomerId(client, "user-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("cus_abc");
  });

  it("returns null when no customer exists", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    });
    const result = await getOrCreateStripeCustomerId(client, "user-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it("returns err on query error", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "DB error" },
            }),
          }),
        }),
      }),
    });
    const result = await getOrCreateStripeCustomerId(client, "user-1");
    expect(result.isErr()).toBe(true);
  });
});

describe("saveStripeCustomerId", () => {
  it("returns ok on success", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const result = await saveStripeCustomerId(client, "user-1", "cus_xyz");
    expect(result.isOk()).toBe(true);
  });

  it("returns err on insert error", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "Duplicate" } }),
      }),
    });
    const result = await saveStripeCustomerId(client, "user-1", "cus_xyz");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Duplicate");
  });
});

describe("creditTokensForPurchase", () => {
  it("returns new balance on success", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({ data: 15, error: null }),
    });
    const result = await creditTokensForPurchase(
      client,
      "user-1",
      "cs_test_123",
      "pack_3",
      3
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(15);
  });

  it("returns err on RPC error", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC failed" } }),
    });
    const result = await creditTokensForPurchase(
      client,
      "user-1",
      "cs_test_123",
      "pack_3",
      3
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("RPC failed");
  });

  it("returns err when data is not a number", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({ data: "not-a-number", error: null }),
    });
    const result = await creditTokensForPurchase(
      client,
      "user-1",
      "cs_test_123",
      "pack_3",
      3
    );
    expect(result.isErr()).toBe(true);
  });
});
