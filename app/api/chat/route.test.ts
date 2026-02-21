import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";

const mockedCreate = vi.mocked(createServerClientInstance);

function fakeSupabaseClient(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    }),
  } as unknown as ServerSupabaseClient;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabaseClient(null));
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        nodes: [],
        edges: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 503 when Bedrock env vars are missing", async () => {
    mockedCreate.mockResolvedValue(fakeSupabaseClient({ id: "user-1" }));
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        nodes: [],
        edges: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("BEDROCK_MODEL_ID");
  });
});
