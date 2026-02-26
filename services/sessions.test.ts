import { describe, it, expect, vi } from "vitest";
import { Effect, Either, Option } from "effect";
import { whenRight } from "@/lib/optionHelpers";
import {
  createSession,
  listSessions,
  getSession,
  updateSession,
  deleteSession,
  getSessionSettings,
  saveSessionSettings,
} from "./sessions";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { DbInterviewSession, DbSessionSettings } from "@/lib/database.aliases";

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
type MockUpdateSingle = {
  data: DbInterviewSession | null;
  error: PostgresError | null;
};
type MockMaybeSingle = {
  data: DbSessionSettings | null;
  error: PostgresError | null;
};
type MockUpsert = { error: PostgresError | null };

/** Captures the argument passed to `.update(fields)` so tests can assert on the exact keys. */
type UpdateCapture = { fields: unknown };

function mockSupabaseClient(overrides: {
  insertSingle?: MockInsertSingle;
  selectEqOrder?: MockSelectOrder;
  selectEqSingle?: MockSelectSingle;
  updateEqSingle?: MockUpdateSingle;
  deleteEq?: MockDelete;
  sessionSettingsSelect?: MockMaybeSingle;
  sessionSettingsUpsert?: MockUpsert;
  /** Pass an object; `.fields` will be set to the argument of `.update()`. */
  updateCapture?: UpdateCapture;
} = {}): ServerSupabaseClient {
  const insertSingle: MockInsertSingle =
    overrides.insertSingle ?? { data: null, error: null };
  const selectEqOrder: MockSelectOrder =
    overrides.selectEqOrder ?? { data: [], error: null };
  const selectEqSingle: MockSelectSingle =
    overrides.selectEqSingle ?? { data: null, error: null };
  const updateEqSingle: MockUpdateSingle =
    overrides.updateEqSingle ?? { data: null, error: null };
  const sessionSettingsSelect: MockMaybeSingle =
    overrides.sessionSettingsSelect ?? { data: null, error: null };
  const sessionSettingsUpsert: MockUpsert =
    overrides.sessionSettingsUpsert ?? { error: null };
  const updateCapture = overrides.updateCapture;
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
    update: vi.fn().mockImplementation((fields: unknown) => {
      if (updateCapture) updateCapture.fields = fields;
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(updateEqSingle),
          }),
        }),
      };
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

async function runEffect<A, E>(effect: Effect.Effect<A, E>): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect));
}

describe("createSession", () => {
  it("returns ok(Session) when insert succeeds", async () => {
    const dbRow = {
      id: "sess-1",
      user_id: "user-1",
      title: "New",
      status: "active",
      is_trial: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const client = mockSupabaseClient({
      insertSingle: { data: dbRow, error: null },
    });
    const result = await runEffect(createSession(client, "user-1", Option.some("New")));
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (s) => {
      expect(s.id).toBe("sess-1");
      expect(s.userId).toBe("user-1");
      expect(s.title).toBe("New");
    });
  });

  it("returns err when insert fails", async () => {
    const client = mockSupabaseClient({
      insertSingle: { data: null, error: { message: "DB error" } },
    });
    const result = await runEffect(createSession(client, "user-1", Option.some("New")));
    expect(Either.isLeft(result)).toBe(true);
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
        is_trial: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const client = mockSupabaseClient({
      selectEqOrder: { data: dbRows, error: null },
    });
    const result = await runEffect(listSessions(client, "user-1"));
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (list) => {
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("A");
    });
  });
});

describe("getSession", () => {
  it("returns ok(Session) when session exists", async () => {
    const dbRow = {
      id: "sess-1",
      user_id: "user-1",
      title: "Get me",
      status: "active",
      is_trial: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const client = mockSupabaseClient({
      selectEqSingle: { data: dbRow, error: null },
    });
    const result = await runEffect(getSession(client, "sess-1"));
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (s) => expect(s.id).toBe("sess-1"));
  });
});

const updatedDbRow = {
  id: "sess-1",
  user_id: "user-1",
  title: "Renamed",
  status: "active",
  is_trial: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:01Z",
};

describe("updateSession", () => {
  it("returns ok(Session) when update succeeds", async () => {
    const client = mockSupabaseClient({
      updateEqSingle: { data: updatedDbRow, error: null },
    });
    const result = await runEffect(
      updateSession(client, "sess-1", { titleOpt: Option.some("Renamed") })
    );
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (s) => {
      expect(s.id).toBe("sess-1");
      expect(s.title).toBe("Renamed");
    });
  });

  it("returns err when update fails", async () => {
    const client = mockSupabaseClient({
      updateEqSingle: { data: null, error: { message: "DB error" } },
    });
    const result = await runEffect(
      updateSession(client, "sess-1", { titleOpt: Option.some("X") })
    );
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rename-only: DB fields include title but NOT status", async () => {
    const capture: { fields: unknown } = { fields: null };
    const client = mockSupabaseClient({
      updateEqSingle: { data: updatedDbRow, error: null },
      updateCapture: capture,
    });
    await runEffect(
      updateSession(client, "sess-1", {
        titleOpt: Option.some("New Title"),
      })
    );
    const sent = capture.fields as Record<string, unknown>;
    expect(sent).toHaveProperty("title", "New Title");
    expect(sent).not.toHaveProperty("status");
  });

  it("terminate-only: DB fields include status but NOT title", async () => {
    const capture: { fields: unknown } = { fields: null };
    const terminatedRow = { ...updatedDbRow, status: "terminated" };
    const client = mockSupabaseClient({
      updateEqSingle: { data: terminatedRow, error: null },
      updateCapture: capture,
    });
    await runEffect(
      updateSession(client, "sess-1", {
        statusOpt: Option.some("terminated"),
      })
    );
    const sent = capture.fields as Record<string, unknown>;
    expect(sent).toHaveProperty("status", "terminated");
    expect(sent).not.toHaveProperty("title");
  });

  it("both fields: DB fields include both title and status", async () => {
    const capture: { fields: unknown } = { fields: null };
    const client = mockSupabaseClient({
      updateEqSingle: { data: updatedDbRow, error: null },
      updateCapture: capture,
    });
    await runEffect(
      updateSession(client, "sess-1", {
        titleOpt: Option.some("New"),
        statusOpt: Option.some("terminated"),
      })
    );
    const sent = capture.fields as Record<string, unknown>;
    expect(sent).toHaveProperty("title", "New");
    expect(sent).toHaveProperty("status", "terminated");
  });

  it("title set to null: DB fields include title as null", async () => {
    const capture: { fields: unknown } = { fields: null };
    const nullTitleRow = { ...updatedDbRow, title: null };
    const client = mockSupabaseClient({
      updateEqSingle: { data: nullTitleRow, error: null },
      updateCapture: capture,
    });
    await runEffect(
      updateSession(client, "sess-1", {
        titleOpt: Option.none(),
      })
    );
    const sent = capture.fields as Record<string, unknown>;
    expect(sent).toHaveProperty("title", null);
    expect(sent).not.toHaveProperty("status");
  });
});

describe("deleteSession", () => {
  it("returns ok(undefined) when delete succeeds", async () => {
    const client = mockSupabaseClient({
      deleteEq: { error: null },
    });
    const result = await runEffect(deleteSession(client, "sess-1"));
    expect(Either.isRight(result)).toBe(true);
  });
});

describe("getSessionSettings", () => {
  it("returns empty settings when no row exists", async () => {
    const client = mockSupabaseClient({
      sessionSettingsSelect: { data: null, error: null },
    });
    const result = await runEffect(getSessionSettings(client, "sess-1"));
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (s) => {
      expect(s).toEqual({});
    });
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
    const result = await runEffect(getSessionSettings(client, "sess-1"));
    expect(Either.isRight(result)).toBe(true);
    whenRight(result, (s) => {
      expect(s).toEqual({});
    });
  });

  it("returns err when select fails", async () => {
    const client = mockSupabaseClient({
      sessionSettingsSelect: { data: null, error: { message: "DB error" } },
    });
    const result = await runEffect(getSessionSettings(client, "sess-1"));
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("saveSessionSettings", () => {
  it("returns ok(undefined) when upsert succeeds", async () => {
    const client = mockSupabaseClient({
      sessionSettingsUpsert: { error: null },
    });
    const result = await runEffect(saveSessionSettings(client, "sess-1", {}));
    expect(Either.isRight(result)).toBe(true);
  });

  it("returns err when upsert fails", async () => {
    const client = mockSupabaseClient({
      sessionSettingsUpsert: { error: { message: "DB error" } },
    });
    const result = await runEffect(saveSessionSettings(client, "sess-1", {}));
    expect(Either.isLeft(result)).toBe(true);
  });
});
