import { Effect, Option } from "effect";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn((opts: { onFinish?: (arg: { text: string }) => void }) => {
      queueMicrotask(() => opts.onFinish?.({ text: "Final summary." }));
      return {
        toDataStreamResponse: () =>
          new Response(new ReadableStream(), { status: 200 }),
      };
    }),
    convertToCoreMessages: vi.fn((msgs: { role: string; content: string }[]) => msgs),
  };
});

vi.mock("@ai-sdk/amazon-bedrock", () => ({
  createAmazonBedrock: vi.fn(() => vi.fn(() => ({}))),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, updateSession } from "@/services/sessions";

const mockedCreateClient = vi.mocked(createServerClientInstance);
const mockedGetSession = vi.mocked(getSession);
const mockedUpdateSession = vi.mocked(updateSession);

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "user-1";

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function sessionFixture(overrides: Partial<Session>): Session {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    title: "Untitled",
    status: "active",
    isTrial: true,
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    conclusionSummary: null,
    ...overrides,
  };
}

function makeRequest(body: unknown, sessionId: string = SESSION_ID): Request {
  return new Request(`http://localhost/api/sessions/${sessionId}/conclusion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(sessionId: string = SESSION_ID) {
  return { params: Promise.resolve({ id: sessionId }) };
}

describe("POST /api/sessions/[id]/conclusion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase(null));
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when session not found", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    mockedGetSession.mockReturnValue(
      Effect.fail({ message: "Not found" })
    );
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Not found");
  });

  it("returns 403 when user does not own session", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    const otherOwnerSession = sessionFixture({
      userId: "other-user",
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    mockedGetSession.mockReturnValue(Effect.succeed(otherOwnerSession));
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden");
  });

  it("returns 403 when time has not expired", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    const notExpiredSession = sessionFixture({
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    });
    mockedGetSession.mockReturnValue(Effect.succeed(notExpiredSession));
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe(
      "Time has not expired. You cannot request the final summary yet."
    );
  });

  it("when simulate_expired is true, bypasses time check (test flow)", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    mockedUpdateSession.mockReturnValue(Effect.succeed(sessionFixture({})));
    try {
      mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
      const notExpiredSession = sessionFixture({
        createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      });
      mockedGetSession.mockReturnValue(Effect.succeed(notExpiredSession));
      const res = await POST(
        makeRequest({
          messages: [{ role: "user", content: "Hi" }],
          nodes: [],
          edges: [],
          simulate_expired: true,
        }),
        params()
      );
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("when user_requested_end is true, bypasses time check regardless of env", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    mockedUpdateSession.mockReturnValue(Effect.succeed(sessionFixture({})));
    try {
      mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
      const notExpiredSession = sessionFixture({
        createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      });
      mockedGetSession.mockReturnValue(Effect.succeed(notExpiredSession));
      const res = await POST(
        makeRequest({
          messages: [{ role: "user", content: "I want to end early." }],
          nodes: [],
          edges: [],
          user_requested_end: true,
        }),
        params()
      );
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("returns 403 when conclusion summary already generated", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    const withConclusion = sessionFixture({
      conclusionSummary: "You did well on X. Improve Y.",
    });
    mockedGetSession.mockReturnValue(Effect.succeed(withConclusion));
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe(
      "Final summary was already generated for this session."
    );
  });

  it("returns 503 when Bedrock env vars are missing", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    delete process.env.BEDROCK_MODEL_ID;
    delete process.env.AWS_REGION;
    try {
      mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
      mockedGetSession.mockReturnValue(Effect.succeed(sessionFixture({})));
      const res = await POST(
        makeRequest({ messages: [], nodes: [], edges: [] }),
        params()
      );
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("BEDROCK_MODEL_ID");
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
    }
  });

  it("returns 200 stream and persists summary when valid and Bedrock mocked", async () => {
    const origModel = process.env.BEDROCK_MODEL_ID;
    const origRegion = process.env.AWS_REGION;
    process.env.BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-v2";
    process.env.AWS_REGION = "us-east-1";
    mockedUpdateSession.mockReturnValue(Effect.succeed(sessionFixture({})));
    try {
      mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
      mockedGetSession.mockReturnValue(Effect.succeed(sessionFixture({})));
      const res = await POST(
        makeRequest({ messages: [{ role: "user", content: "Done" }], nodes: [], edges: [] }),
        params()
      );
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
      await new Promise((r) => setTimeout(r, 0));
      expect(mockedUpdateSession).toHaveBeenCalledWith(
        expect.anything(),
        SESSION_ID,
        USER_ID,
        { conclusionSummaryOpt: Option.some("Final summary.") }
      );
    } finally {
      if (origModel !== undefined) process.env.BEDROCK_MODEL_ID = origModel;
      else delete process.env.BEDROCK_MODEL_ID;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
      else delete process.env.AWS_REGION;
    }
  });

  it("returns 400 for invalid JSON", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    mockedGetSession.mockReturnValue(
      Effect.succeed(sessionFixture({}))
    );
    const req = new Request(
      `http://localhost/api/sessions/${SESSION_ID}/conclusion`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }
    );
    const res = await POST(req, params());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 for invalid body (e.g. messages not array)", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    mockedGetSession.mockReturnValue(
      Effect.succeed(sessionFixture({}))
    );
    const res = await POST(
      makeRequest({ messages: "invalid", nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(400);
  });

  // TEST-5: simulate_expired must be rejected in production without the flag
  it("returns 403 when simulate_expired=true in production without ALLOW_SIMULATE_EXPIRED", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SIMULATE_EXPIRED", "");
    try {
      mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
      mockedGetSession.mockReturnValue(
        Effect.succeed(
          sessionFixture({
            // Session created 1 minute ago — not expired yet
            createdAt: new Date(Date.now() - 60_000).toISOString(),
          })
        )
      );
      const res = await POST(
        makeRequest({ messages: [], nodes: [], edges: [], simulate_expired: true }),
        params()
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Time has not expired/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
