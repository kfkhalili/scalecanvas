import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_CHAT_BODY_BYTES } from "@/lib/api.schemas";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  getSystemPrompt: vi.fn((ctx: string) => `DEFAULT_PROMPT:${ctx}`),
  getSystemPromptOpening: vi.fn((problemText: string) => `OPENING_PROMPT:${problemText}`),
  getSystemPromptDesign: vi.fn((ctx: string) => `DESIGN_PROMPT:${ctx}`),
  getSystemPromptConclusion: vi.fn(() => "CONCLUSION_PROMPT"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toDataStreamResponse: () => new Response(null, { status: 200 }),
    })),
    convertToCoreMessages: vi.fn((msgs: { role: string; content: string }[]) => msgs),
  };
});

vi.mock("@ai-sdk/amazon-bedrock", () => ({
  createAmazonBedrock: vi.fn(() => vi.fn(() => ({}))),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import {
  getSystemPrompt,
  getSystemPromptOpening,
  getSystemPromptDesign,
  getSystemPromptConclusion,
} from "@/lib/prompts";

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
    vi.clearAllMocks();
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

  it("uses getSystemPromptOpening when phase is opening and problem_text is provided", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      const sessionRow = {
        id: validSessionId,
        user_id: "user-1",
        title: null,
        status: "active",
        is_trial: false,
        created_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
        conclusion_summary: null,
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
      const problemText = "Design a URL shortener like Bit.ly.";
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
          nodes: [],
          edges: [],
          session_id: validSessionId,
          phase: "opening",
          problem_text: problemText,
        }),
      });

      await POST(req);

      expect(getSystemPromptOpening).toHaveBeenCalledWith(problemText);
      expect(getSystemPrompt).not.toHaveBeenCalled();
      expect(getSystemPromptDesign).not.toHaveBeenCalled();
      expect(getSystemPromptConclusion).not.toHaveBeenCalled();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("uses getSystemPromptDesign when phase is design", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      const sessionRow = {
        id: validSessionId,
        user_id: "user-1",
        title: null,
        status: "active",
        is_trial: false,
        created_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
        conclusion_summary: null,
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
          messages: [{ role: "user", content: "Here is my design" }],
          nodes: [
            {
              id: "n1",
              position: { x: 0, y: 0 },
              data: { label: "API" },
            },
          ],
          edges: [],
          session_id: validSessionId,
          phase: "design",
        }),
      });

      await POST(req);

      expect(getSystemPromptDesign).toHaveBeenCalledTimes(1);
      expect(getSystemPromptDesign).toHaveBeenCalledWith(expect.any(String));
      expect(getSystemPrompt).not.toHaveBeenCalled();
      expect(getSystemPromptOpening).not.toHaveBeenCalled();
      expect(getSystemPromptConclusion).not.toHaveBeenCalled();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("uses getSystemPrompt when phase is omitted (default)", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      const sessionRow = {
        id: validSessionId,
        user_id: "user-1",
        title: null,
        status: "active",
        is_trial: false,
        created_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
        conclusion_summary: null,
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

      await POST(req);

      expect(getSystemPrompt).toHaveBeenCalledTimes(1);
      expect(getSystemPrompt).toHaveBeenCalledWith(expect.any(String));
      expect(getSystemPromptOpening).not.toHaveBeenCalled();
      expect(getSystemPromptDesign).not.toHaveBeenCalled();
      expect(getSystemPromptConclusion).not.toHaveBeenCalled();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("uses getSystemPromptConclusion when phase is conclusion", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    try {
      const sessionRow = {
        id: validSessionId,
        user_id: "user-1",
        title: null,
        status: "active",
        is_trial: false,
        created_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
        conclusion_summary: null,
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
          messages: [{ role: "user", content: "Please summarize" }],
          nodes: [],
          edges: [],
          session_id: validSessionId,
          phase: "conclusion",
        }),
      });

      await POST(req);

      expect(getSystemPromptConclusion).toHaveBeenCalledTimes(1);
      expect(getSystemPromptConclusion).toHaveBeenCalledWith();
      expect(getSystemPrompt).not.toHaveBeenCalled();
      expect(getSystemPromptOpening).not.toHaveBeenCalled();
      expect(getSystemPromptDesign).not.toHaveBeenCalled();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });
});
