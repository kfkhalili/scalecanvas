import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_CHAT_BODY_BYTES } from "@/lib/api.schemas";

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
    rpc: vi.fn().mockResolvedValue({
      data: { allowed: true, remaining: 19, resetAt: new Date().toISOString() },
      error: null,
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

  const validSessionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  // Session ownership (403 when session belongs to another user) is covered by
  // lib/chatGuardrails.test.ts: "returns 403 when userId does not match session owner".
  // session_id UUID and array-length validation are applied by ChatBodySchema.safeParse before the guardrail.

  it("returns 503 when Bedrock env vars are missing", async () => {
    const sessionRow = {
      id: validSessionId,
      user_id: "user-1",
      title: null,
      status: "active",
      is_trial: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const client = fakeSupabaseClient({ id: "user-1" });
    (client.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: sessionRow, error: null }),
        }),
      }),
    });
    mockedCreate.mockResolvedValue(client);
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        nodes: [],
        edges: [],
        session_id: validSessionId,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("BEDROCK_MODEL_ID");
  });

  it("returns 400 when request body is too large", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      mockedCreate.mockResolvedValue(fakeSupabaseClient({ id: "user-1" }));
      const body = JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        nodes: [],
        edges: [],
      });
      const oversized = body + "x".repeat(Math.max(0, MAX_CHAT_BODY_BYTES - body.length + 1));
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: oversized,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Request body too large.");
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("returns 400 when session_id is not a valid UUID", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      mockedCreate.mockResolvedValue(fakeSupabaseClient({ id: "user-1" }));
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
          nodes: [],
          edges: [],
          session_id: "not-a-uuid",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("session_id must be a valid UUID.");
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("returns 400 when messages are missing", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      mockedCreate.mockResolvedValue(fakeSupabaseClient({ id: "user-1" }));
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: [], edges: [] }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid request body: messages required.");
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });
});
