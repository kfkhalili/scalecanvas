import { Effect, Either, Option } from "effect";
import { describe, it, expect, vi } from "vitest";
import {
  getTokenBalance,
  findStripeCustomerId,
  saveStripeCustomerId,
  creditTokensForPurchase,
} from "./tokens";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

function asClient(mock: Record<string, unknown>): ServerSupabaseClient {
  return mock as unknown as ServerSupabaseClient;
}

function runEffect<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.runPromise(Effect.either(effect));
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
    const either = await runEffect(getTokenBalance(client, "user-1"));
    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) expect(either.right).toBe(10);
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
    const either = await runEffect(getTokenBalance(client, "user-1"));
    expect(Either.isLeft(either)).toBe(true);
  });
});

describe("findStripeCustomerId", () => {
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
    const either = await runEffect(findStripeCustomerId(client, "user-1"));
    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either))
      expect(Option.getOrNull(either.right)).toBe("cus_abc");
  });

  it("returns none when no customer exists", async () => {
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
    const either = await runEffect(findStripeCustomerId(client, "user-1"));
    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) expect(Option.isNone(either.right)).toBe(true);
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
    const either = await runEffect(findStripeCustomerId(client, "user-1"));
    expect(Either.isLeft(either)).toBe(true);
  });
});

describe("saveStripeCustomerId", () => {
  it("returns ok on success", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const either = await runEffect(
      saveStripeCustomerId(client, "user-1", "cus_xyz")
    );
    expect(Either.isRight(either)).toBe(true);
  });

  it("returns err on insert error", async () => {
    const client = asClient({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "Duplicate" } }),
      }),
    });
    const either = await runEffect(
      saveStripeCustomerId(client, "user-1", "cus_xyz")
    );
    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) expect(either.left.message).toBe("Duplicate");
  });
});

describe("creditTokensForPurchase", () => {
  it("returns new balance on success", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({ data: 15, error: null }),
    });
    const either = await runEffect(
      creditTokensForPurchase(client, "user-1", "cs_test_123", "pack_3", 3)
    );
    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) expect(either.right).toBe(15);
  });

  it("returns err on RPC error", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      }),
    });
    const either = await runEffect(
      creditTokensForPurchase(client, "user-1", "cs_test_123", "pack_3", 3)
    );
    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) expect(either.left.message).toBe("RPC failed");
  });

  it("returns err when data is not a number", async () => {
    const client = asClient({
      rpc: vi.fn().mockResolvedValue({
        data: "not-a-number",
        error: null,
      }),
    });
    const either = await runEffect(
      creditTokensForPurchase(client, "user-1", "cs_test_123", "pack_3", 3)
    );
    expect(Either.isLeft(either)).toBe(true);
  });
});
