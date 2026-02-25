import { Effect } from "effect";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/tokens", () => ({
  getTokenBalance: vi.fn(),
}));

import { GET } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTokenBalance } from "@/services/tokens";

const mockedCreate = vi.mocked(createServerClientInstance);
const mockedGetBalance = vi.mocked(getTokenBalance);

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

describe("GET /api/tokens/balance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase(null));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns token balance on success", async () => {
    const client = fakeSupabase({ id: "user-1" });
    mockedCreate.mockResolvedValue(client);
    mockedGetBalance.mockReturnValue(Effect.succeed(12));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tokens).toBe(12);
  });

  it("returns 500 on service error", async () => {
    const client = fakeSupabase({ id: "user-1" });
    mockedCreate.mockResolvedValue(client);
    mockedGetBalance.mockReturnValue(Effect.fail({ message: "DB down" }));
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB down");
  });
});
