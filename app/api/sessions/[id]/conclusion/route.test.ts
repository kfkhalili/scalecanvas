import { Effect } from "effect";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  getSession: vi.fn(),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession } from "@/services/sessions";

const mockedCreateClient = vi.mocked(createServerClientInstance);
const mockedGetSession = vi.mocked(getSession);

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

  it("returns 200 with ok true when valid and expired and no conclusion", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: USER_ID }));
    const expiredNoConclusion = sessionFixture({});
    mockedGetSession.mockReturnValue(Effect.succeed(expiredNoConclusion));
    const res = await POST(
      makeRequest({ messages: [], nodes: [], edges: [] }),
      params()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
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
});
