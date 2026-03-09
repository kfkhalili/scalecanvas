import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  appendTranscriptBatch: vi.fn(),
}));

import { POST } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { appendTranscriptBatch } from "@/services/sessions";

const mockedCreate = vi.mocked(createServerClientInstance);
const mockedBatch = vi.mocked(appendTranscriptBatch);

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function buildParams() {
  return { params: Promise.resolve({ id: "sess-1" }) };
}

const VALID_ENTRIES = [
  { id: "b0000000-0000-4000-8000-000000000001", role: "user" as const, content: "Hello" },
  { id: "b0000000-0000-4000-8000-000000000002", role: "assistant" as const, content: "Hi there" },
];

function buildPost(body: unknown): Request {
  return new Request("http://localhost/api/sessions/sess-1/transcript/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessions/[id]/transcript/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase(null));
    const res = await POST(buildPost({ entries: VALID_ENTRIES }), buildParams());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const req = new Request(
      "http://localhost/api/sessions/sess-1/transcript/batch",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" }
    );
    const res = await POST(req, buildParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 when entries array is missing", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(buildPost({}), buildParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when entries array is empty", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(buildPost({ entries: [] }), buildParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when an entry has invalid role", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(
      buildPost({ entries: [{ id: "b0000000-0000-4000-8000-000000000001", role: "system", content: "Hi" }] }),
      buildParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when an entry has empty content", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(
      buildPost({ entries: [{ id: "b0000000-0000-4000-8000-000000000001", role: "user", content: "" }] }),
      buildParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when an entry has content exceeding 50 000 chars", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const res = await POST(
      buildPost({ entries: [{ id: "b0000000-0000-4000-8000-000000000001", role: "user", content: "x".repeat(50_001) }] }),
      buildParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with count on success", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedBatch.mockReturnValue(Effect.succeed(undefined));
    const res = await POST(buildPost({ entries: VALID_ENTRIES }), buildParams());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ count: 2 });
  });

  it("passes session id and entries to appendTranscriptBatch", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedBatch.mockReturnValue(Effect.succeed(undefined));
    await POST(buildPost({ entries: VALID_ENTRIES }), buildParams());
    expect(mockedBatch).toHaveBeenCalledWith(expect.anything(), "sess-1", VALID_ENTRIES);
  });

  it("returns 500 when appendTranscriptBatch fails", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedBatch.mockReturnValue(Effect.fail({ message: "Batch write failed" }));
    const res = await POST(buildPost({ entries: VALID_ENTRIES }), buildParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Batch write failed");
  });
});
