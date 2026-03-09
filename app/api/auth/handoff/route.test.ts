import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Option } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/handoff", () => ({
  claimTrialAndCreateSession: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  HANDOFF_RATE_LIMIT: { windowMs: 60_000, maxRequests: 5 },
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { claimTrialAndCreateSession } from "@/services/handoff";
import { checkRateLimit } from "@/lib/rateLimit";

const mockedCreateClient = vi.mocked(createServerClientInstance);
const mockedClaimTrial = vi.mocked(claimTrialAndCreateSession);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/handoff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/handoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedCheckRateLimit.mockImplementation(() =>
      Effect.succeed({ allowed: true, remaining: 4, resetAt: new Date().toISOString() })
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase(null));
    const res = await POST(makeRequest({ question_title: "URL Shortener" }));
    expect(res.status).toBe(401);
  });

  it("returns 201 and session_id when trial claimed", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedClaimTrial.mockReturnValue(Effect.succeed("session-123"));
    const res = await POST(makeRequest({ question_title: "URL Shortener" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ created: true, session_id: "session-123" });
    expect(mockedClaimTrial).toHaveBeenCalledWith(
      expect.anything(),
      Option.some("URL Shortener")
    );
  });

  it("returns 200 and created false when trial already claimed", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedClaimTrial.mockReturnValue(
      Effect.fail({ message: "Trial already claimed" })
    );
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ created: false });
  });

  it("returns 400 for invalid JSON", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const req = new Request("http://localhost/api/auth/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("accepts empty body", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedClaimTrial.mockReturnValue(Effect.succeed("session-456"));
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(201);
    expect(mockedClaimTrial).toHaveBeenCalledWith(
      expect.anything(),
      Option.none()
    );
  });

  it("returns 429 with Retry-After header when rate limited", async () => {
    mockedCreateClient.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    mockedCheckRateLimit.mockReturnValue(
      Effect.fail({ allowed: false, remaining: 0, resetAt })
    );
    const res = await POST(makeRequest({ question_title: "test" }));
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    expect(Number(retryAfter)).toBeLessThanOrEqual(30);
  });
});
