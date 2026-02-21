import { describe, it, expect, vi } from "vitest";
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  getSessionSettings,
  saveSessionSettings,
} from "./sessions";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { DbInterviewSession, DbSessionSettings } from "@/lib/database.types";

type PostgresError = { message: string };
type MockInsertSingle = {
  data: DbInterviewSession | null;
  error: PostgresError | null;
};
type MockSelectOrder = { data: DbInterviewSession[]; error: PostgresError | null };
type MockSelectSingle = {
  data: DbInterviewSession | null;
  error: PostgresError | null;
};
type MockDelete = { error: PostgresError | null };
type MockMaybeSingle = {
  data: DbSessionSettings | null;
  error: PostgresError | null;
};
type MockUpsert = { error: PostgresError | null };

function mockSupabaseClient(overrides: {
  insertSingle?: MockInsertSingle;
  selectEqOrder?: MockSelectOrder;
  selectEqSingle?: MockSelectSingle;
  deleteEq?: MockDelete;
  sessionSettingsSelect?: MockMaybeSingle;
  sessionSettingsUpsert?: MockUpsert;
} = {}): ServerSupabaseClient {
  const insertSingle: MockInsertSingle =
    overrides.insertSingle ?? { data: null, error: null };
  const selectEqOrder: MockSelectOrder =
    overrides.selectEqOrder ?? { data: [], error: null };
  const selectEqSingle: MockSelectSingle =
    overrides.selectEqSingle ?? { data: null, error: null };
  const sessionSettingsSelect: MockMaybeSingle =
    overrides.sessionSettingsSelect ?? { data: null, error: null };
  const sessionSettingsUpsert: MockUpsert =
    overrides.sessionSettingsUpsert ?? { error: null };
  const chain = {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(insertSingle),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(selectEqOrder),
        single: vi.fn().mockResolvedValue(selectEqSingle),
        maybeSingle: vi.fn().mockResolvedValue(sessionSettingsSelect),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(overrides.deleteEq ?? { error: null }),
    }),
  };
  const sessionSettingsChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(sessionSettingsSelect),
      }),
    }),
    upsert: vi.fn().mockResolvedValue(sessionSettingsUpsert),
  };
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "session_settings") return sessionSettingsChain;
    return chain;
  });
  return asServerSupabaseClient({ from });
}

/**
 * Test-only: assert partial mock as ServerSupabaseClient.
 * Strict-typing: single escape (mock does not implement full client).
 */
function asServerSupabaseClient(
  mock: { from: (table: string) => object }
): ServerSupabaseClient {
  return mock as ServerSupabaseClient;
}

describe("createSession", () => {
  it("returns ok(Session) when insert succeeds", async () => {
    const dbRow = {
      id: "sess-1",
      user_id: "user-1",
      title: "New",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const client = mockSupabaseClient({
      insertSingle: { data: dbRow, error: null },
    });
    const result = await createSession(client, "user-1", "New");
    expect(result.isOk()).toBe(true);
    result.match(
      (s) => {
        expect(s.id).toBe("sess-1");
        expect(s.userId).toBe("user-1");
        expect(s.title).toBe("New");
      },
      () => {}
    );
  });

  it("returns err when insert fails", async () => {
    const client = mockSupabaseClient({
      insertSingle: { data: null, error: { message: "DB error" } },
    });
    const result = await createSession(client, "user-1", "New");
    expect(result.isErr()).toBe(true);
  });
});

describe("listSessions", () => {
  it("returns ok(Session[]) when select succeeds", async () => {
    const dbRows = [
      {
        id: "sess-1",
        user_id: "user-1",
        title: "A",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const client = mockSupabaseClient({
      selectEqOrder: { data: dbRows, error: null },
    });
    const result = await listSessions(client, "user-1");
    expect(result.isOk()).toBe(true);
    result.match(
      (list) => {
        expect(list).toHaveLength(1);
        expect(list[0].title).toBe("A");
      },
      () => {}
    );
  });
});

describe("getSession", () => {
  it("returns ok(Session) when session exists", async () => {
    const dbRow = {
      id: "sess-1",
      user_id: "user-1",
      title: "Get me",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const client = mockSupabaseClient({
      selectEqSingle: { data: dbRow, error: null },
    });
    const result = await getSession(client, "sess-1");
    expect(result.isOk()).toBe(true);
    result.match(
      (s) => expect(s.id).toBe("sess-1"),
      () => {}
    );
  });
});

describe("deleteSession", () => {
  it("returns ok(undefined) when delete succeeds", async () => {
    const client = mockSupabaseClient({
      deleteEq: { error: null },
    });
    const result = await deleteSession(client, "sess-1");
    expect(result.isOk()).toBe(true);
  });
});

describe("getSessionSettings", () => {
  it("returns empty settings when no row exists", async () => {
    const client = mockSupabaseClient({
      sessionSettingsSelect: { data: null, error: null },
    });
    const result = await getSessionSettings(client, "sess-1");
    expect(result.isOk()).toBe(true);
    result.match(
      (s) => {
        expect(s).toEqual({});
      },
      () => {}
    );
  });

  it("returns empty settings when row exists", async () => {
    const client = mockSupabaseClient({
      sessionSettingsSelect: {
        data: {
          session_id: "sess-1",
          auto_review_enabled: true,
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      },
    });
    const result = await getSessionSettings(client, "sess-1");
    expect(result.isOk()).toBe(true);
    result.match(
      (s) => {
        expect(s).toEqual({});
      },
      () => {}
    );
  });

  it("returns err when select fails", async () => {
    const client = mockSupabaseClient({
      sessionSettingsSelect: { data: null, error: { message: "DB error" } },
    });
    const result = await getSessionSettings(client, "sess-1");
    expect(result.isErr()).toBe(true);
  });
});

describe("saveSessionSettings", () => {
  it("returns ok(undefined) when upsert succeeds", async () => {
    const client = mockSupabaseClient({
      sessionSettingsUpsert: { error: null },
    });
    const result = await saveSessionSettings(client, "sess-1", {});
    expect(result.isOk()).toBe(true);
  });

  it("returns err when upsert fails", async () => {
    const client = mockSupabaseClient({
      sessionSettingsUpsert: { error: { message: "DB error" } },
    });
    const result = await saveSessionSettings(client, "sess-1", {});
    expect(result.isErr()).toBe(true);
  });
});
