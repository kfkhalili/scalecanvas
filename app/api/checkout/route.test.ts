import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
  getPackById: vi.fn(),
  getStripePriceId: vi.fn(),
}));

vi.mock("@/services/tokens", () => ({
  getOrCreateStripeCustomerId: vi.fn(),
  saveStripeCustomerId: vi.fn(),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getStripeClient, getPackById, getStripePriceId } from "@/lib/stripe";
import { getOrCreateStripeCustomerId, saveStripeCustomerId } from "@/services/tokens";

const mockedCreateClient = vi.mocked(createServerClientInstance);
const mockedGetPack = vi.mocked(getPackById);
const mockedGetPrice = vi.mocked(getStripePriceId);
const mockedGetStripeClient = vi.mocked(getStripeClient);
const mockedGetCustomer = vi.mocked(getOrCreateStripeCustomerId);
const mockedSaveCustomer = vi.mocked(saveStripeCustomerId);

const PACK = { id: "pack_5", tokens: 5, label: "5", priceUsd: 49, priceEnvKey: "STRIPE_PRICE_ID_5" } as const;

function fakeSupabase(user: { id: string; email?: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

function fakeStripe(sessionUrl: string | null = "https://checkout.stripe.com/test"): {
  customers: { create: ReturnType<typeof vi.fn> };
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
} {
  return {
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: sessionUrl }) } },
  };
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase(null));
    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid pack_id", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(undefined);
    const res = await POST(makeRequest({ pack_id: "invalid" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid pack_id");
  });

  it("returns 503 when price is not configured", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue(undefined);
    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(503);
  });

  it("returns 400 for missing body", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns checkout URL for existing Stripe customer", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1", email: "a@b.com" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue("price_abc");
    mockedGetCustomer.mockResolvedValue(ok("cus_existing"));
    const stripe = fakeStripe();
    mockedGetStripeClient.mockReturnValue(stripe as never);

    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.com/test");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        client_reference_id: "user-1",
        mode: "payment",
      })
    );
  });

  it("creates a new Stripe customer when none exists", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1", email: "a@b.com" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue("price_abc");
    mockedGetCustomer.mockResolvedValue(ok(null));
    mockedSaveCustomer.mockResolvedValue(ok(undefined));
    const stripe = fakeStripe();
    mockedGetStripeClient.mockReturnValue(stripe as never);

    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(200);
    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" })
    );
    expect(mockedSaveCustomer).toHaveBeenCalledWith(expect.anything(), "user-1", "cus_new");
  });

  it("returns 500 when getOrCreateStripeCustomerId fails", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue("price_abc");
    mockedGetCustomer.mockResolvedValue(err({ message: "DB error" }));
    mockedGetStripeClient.mockReturnValue(fakeStripe() as never);

    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });

  it("returns 500 when saveStripeCustomerId fails", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue("price_abc");
    mockedGetCustomer.mockResolvedValue(ok(null));
    mockedSaveCustomer.mockResolvedValue(err({ message: "save failed" }));
    const stripe = fakeStripe();
    mockedGetStripeClient.mockReturnValue(stripe as never);

    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("save failed");
  });

  it("returns 500 when Stripe session has no URL", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(PACK);
    mockedGetPrice.mockReturnValue("price_abc");
    mockedGetCustomer.mockResolvedValue(ok("cus_existing"));
    const stripe = fakeStripe(null);
    mockedGetStripeClient.mockReturnValue(stripe as never);

    const res = await POST(makeRequest({ pack_id: "pack_5" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create checkout session");
  });
});
