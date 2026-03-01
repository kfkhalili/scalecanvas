import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { TranscriptEntry } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  getTranscript: vi.fn(),
  appendTranscriptEntry: vi.fn(),
}));

import { GET, POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTranscript, appendTranscriptEntry } from "@/services/sessions";

const mockedCreate = vi.mocked(createServerClientInstance);
const mockedGetTranscript = vi.mocked(getTranscript);
const mockedAppend = vi.mocked(appendTranscriptEntry);

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function buildParams() {
  return { params: Promise.resolve({ id: "sess-1" }) };
}

function buildGet(): Request {
  return new Request("http://localhost/api/sessions/sess-1/transcript");
}

function buildPost(body: unknown): Request {
  return new Request("http://localhost/api/sessions/sess-1/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SAMPLE_ENTRY: TranscriptEntry = {
  id: "entry-1",
  sessionId: "sess-1",
  role: "user",
  content: "Hello",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("GET /api/sessions/[id]/transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase(null));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 200 with transcript entries on success", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetTranscript.mockReturnValue(Effect.succeed([SAMPLE_ENTRY]));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([SAMPLE_ENTRY]);
  });

  it("returns 200 with empty array when transcript is empty", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetTranscript.mockReturnValue(Effect.succeed([]));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 when getTranscript fails", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetTranscript.mockReturnValue(Effect.fail({ message: "DB read error" }));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB read error");
  });

  it("passes the session id to getTranscript", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetTranscript.mockReturnValue(Effect.succeed([]));
    await GET(buildGet(), buildParams());
    expect(mockedGetTranscript).toHaveBeenCalledWith(expect.anything(), "sess-1");
  });
});

describe("POST /api/sessions/[id]/transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase(null));
    const res = await POST(buildPost({ role: "user", content: "Hi" }), buildParams());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const req = new Request("http://localhost/api/sessions/sess-1/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req, buildParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 when role is invalid", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(buildPost({ role: "system", content: "Hi" }), buildParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(buildPost({ role: "user", content: "" }), buildParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 50 000 chars", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(
      buildPost({ role: "assistant", content: "x".repeat(50_001) }),
      buildParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with the entry on success", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedAppend.mockReturnValue(Effect.succeed(SAMPLE_ENTRY));
    const res = await POST(buildPost({ role: "user", content: "Hello" }), buildParams());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual(SAMPLE_ENTRY);
  });

  it("passes session id, role, and content to appendTranscriptEntry", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedAppend.mockReturnValue(Effect.succeed(SAMPLE_ENTRY));
    await POST(buildPost({ role: "assistant", content: "Answer" }), buildParams());
    expect(mockedAppend).toHaveBeenCalledWith(
      expect.anything(),
      "sess-1",
      "assistant",
      "Answer"
    );
  });

  it("returns 500 when appendTranscriptEntry fails", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedAppend.mockReturnValue(Effect.fail({ message: "Write failed" }));
    const res = await POST(buildPost({ role: "user", content: "Hi" }), buildParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Write failed");
  });
});
