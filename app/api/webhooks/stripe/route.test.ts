import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/tokens", () => ({
  creditTokensForPurchase: vi.fn(),
}));

import { Effect } from "effect";
import { POST } from "./route";
import { getStripeClient } from "@/lib/stripe";
import { creditTokensForPurchase } from "@/services/tokens";
import { createServerClientInstance } from "@/lib/supabase/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

const mockedGetStripe = vi.mocked(getStripeClient);
const mockedCreditTokens = vi.mocked(creditTokensForPurchase);
const mockedCreateClient = vi.mocked(createServerClientInstance);

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing stripe-signature header");
  });

  it("returns 400 when signature verification fails", async () => {
    mockedGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error("Bad signature");
        }),
      },
    } as unknown as Stripe);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("credits tokens on checkout.session.completed with valid metadata", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            pack_id: "pack_3",
            user_id: "user-1",
            tokens: "3",
          },
        },
      },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue(fakeEvent),
      },
    } as unknown as Stripe);

    mockedCreateClient.mockResolvedValue({} as ServerSupabaseClient);
    mockedCreditTokens.mockReturnValue(Effect.succeed(15));

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(mockedCreditTokens).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "cs_test_123",
      "pack_3",
      3
    );
  });

  it("returns 200 even when metadata is missing (no crash)", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_test_456", metadata: {} },
      },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue(fakeEvent) },
    } as unknown as Stripe);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockedCreditTokens).not.toHaveBeenCalled();
  });

  it("skips crediting when tokens metadata is non-numeric", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_bad_tok",
          metadata: { pack_id: "pack_3", user_id: "user-1", tokens: "not-a-number" },
        },
      },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue(fakeEvent) },
    } as unknown as Stripe);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockedCreditTokens).not.toHaveBeenCalled();
  });

  it("skips crediting when tokens is zero", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_zero",
          metadata: { pack_id: "pack_3", user_id: "user-1", tokens: "0" },
        },
      },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue(fakeEvent) },
    } as unknown as Stripe);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockedCreditTokens).not.toHaveBeenCalled();
  });

  it("returns 500 when creditTokensForPurchase fails so Stripe retries", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_fail",
          metadata: { pack_id: "pack_3", user_id: "user-1", tokens: "3" },
        },
      },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue(fakeEvent) },
    } as unknown as Stripe);

    mockedCreateClient.mockResolvedValue({} as ServerSupabaseClient);
    mockedCreditTokens.mockReturnValue(Effect.fail({ message: "DB error" }));

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(mockedCreditTokens).toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe("Token credit failed");
    expect(json.detail).toBe("DB error");
  });

  it("returns 200 for non-checkout event types", async () => {
    const fakeEvent = {
      type: "invoice.paid",
      data: { object: { id: "inv_test" } },
    };

    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue(fakeEvent) },
    } as unknown as Stripe);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_test" },
      body: JSON.stringify(fakeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockedCreditTokens).not.toHaveBeenCalled();
  });
});
