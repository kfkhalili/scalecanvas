import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { getPackById, getStripePriceId } from "@/lib/stripe";

const mockedCreateClient = vi.mocked(createServerClientInstance);
const mockedGetPack = vi.mocked(getPackById);
const mockedGetPrice = vi.mocked(getStripePriceId);

function fakeSupabase(user: { id: string; email?: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase(null));
    const req = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_5" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid pack_id", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue(undefined);
    const req = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "invalid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid pack_id");
  });

  it("returns 503 when price is not configured", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetPack.mockReturnValue({ id: "pack_5", tokens: 5, label: "5", priceEnvKey: "STRIPE_PRICE_ID_5" });
    mockedGetPrice.mockReturnValue(undefined);
    const req = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_5" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns 400 for missing body", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const req = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
