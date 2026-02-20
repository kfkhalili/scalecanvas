import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

const createServerClientInstance = await import(
  "@/lib/supabase/server"
).then((m) => m.createServerClientInstance);

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.mocked(createServerClientInstance).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(createServerClientInstance).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

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
    expect(json).toEqual({ error: "Unauthorized" });
  });
});
