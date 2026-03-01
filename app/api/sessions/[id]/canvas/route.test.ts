import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({
  createServerClientInstance: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  getSession: vi.fn(),
  saveCanvasState: vi.fn(),
  getCanvasState: vi.fn(),
}));

import { GET, PUT } from "./route";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, saveCanvasState, getCanvasState } from "@/services/sessions";
import { MAX_NODES } from "@/lib/api.schemas";

const mockedCreate = vi.mocked(createServerClientInstance);
const mockedGetSession = vi.mocked(getSession);
const mockedSave = vi.mocked(saveCanvasState);
const mockedGetCanvas = vi.mocked(getCanvasState);

function fakeSupabase(user: { id: string } | null): ServerSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as ServerSupabaseClient;
}

function buildPut(body: unknown): Request {
  return new Request("http://localhost/api/sessions/sess-1/canvas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildGet(): Request {
  return new Request("http://localhost/api/sessions/sess-1/canvas", {
    method: "GET",
  });
}

const VALID_BODY = {
  nodes: [{ id: "n1", type: "default", position: { x: 0, y: 0 } }],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function buildParams() {
  return { params: Promise.resolve({ id: "sess-1" }) };
}

describe("GET /api/sessions/[id]/canvas", () => {
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

  it("returns 200 with canvas state on success", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const canvasState = { nodes: [], edges: [], viewport: undefined };
    mockedGetCanvas.mockReturnValue(Effect.succeed(canvasState));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(canvasState);
  });

  it("returns 500 when getCanvasState fails", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetCanvas.mockReturnValue(Effect.fail({ message: "DB read error" }));
    const res = await GET(buildGet(), buildParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB read error");
  });
});

describe("PUT /api/sessions/[id]/canvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase(null));
    const res = await PUT(buildPut(VALID_BODY), buildParams());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when the session is not found / not owned by user", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.fail({ message: "Not found", code: "NOT_FOUND" }));
    const res = await PUT(buildPut(VALID_BODY), buildParams());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid JSON", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.succeed({} as Session));
    const req = new Request("http://localhost/api/sessions/sess-1/canvas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PUT(req, buildParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 when nodes array exceeds MAX_NODES", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.succeed({} as Session));
    const tooManyNodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({
      id: `n${i}`,
      type: "default",
      position: { x: i, y: 0 },
    }));
    const res = await PUT(buildPut({ nodes: tooManyNodes, edges: [] }), buildParams());
    expect(res.status).toBe(400);
  });

  it("returns 204 on successful save", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.succeed({} as Session));
    mockedSave.mockReturnValue(Effect.succeed(undefined));
    const res = await PUT(buildPut(VALID_BODY), buildParams());
    expect(res.status).toBe(204);
  });

  it("returns 500 when saveCanvasState fails", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.succeed({} as Session));
    mockedSave.mockReturnValue(Effect.fail({ message: "Write failed", code: "DB_ERROR" }));
    const res = await PUT(buildPut(VALID_BODY), buildParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Write failed");
    expect(json.code).toBe("DB_ERROR");
  });

  it("passes nodes with data defaulted to {} when data is missing", async () => {
    mockedCreate.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    mockedGetSession.mockReturnValue(Effect.succeed({} as Session));
    mockedSave.mockReturnValue(Effect.succeed(undefined));
    const body = {
      nodes: [{ id: "n1", type: "default", position: { x: 0, y: 0 } }],
      edges: [],
    };
    await PUT(buildPut(body), buildParams());
    expect(mockedSave).toHaveBeenCalledWith(
      expect.anything(),
      "sess-1",
      expect.objectContaining({
        nodes: [expect.objectContaining({ data: {} })],
      })
    );
  });
});
