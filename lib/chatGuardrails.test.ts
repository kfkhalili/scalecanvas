import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import { getSessionIfWithinTimeLimit } from "./chatGuardrails";
import type { Session } from "@/lib/types";

const SESSION_ID = "session-1";
const NOW = 1_000_000_000_000; // some base time in ms

function session(createdAt: string): Session {
  return {
    id: SESSION_ID,
    userId: "user-1",
    title: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("getSessionIfWithinTimeLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when sessionId is missing", async () => {
    const fetchSession = vi.fn();
    const result = await getSessionIfWithinTimeLimit(fetchSession, undefined, 900_000);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(401);
      expect(result.error.error).toBe("Unauthorized.");
    }
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("returns 401 when sessionId is empty string", async () => {
    const fetchSession = vi.fn();
    const result = await getSessionIfWithinTimeLimit(
      fetchSession as (id: string) => Promise<ReturnType<typeof ok<Session>>>,
      "",
      900_000
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.status).toBe(401);
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("returns 401 when fetchSession returns err", async () => {
    const fetchSession = vi.fn().mockResolvedValue(err({ message: "Not found" }));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, 900_000);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(401);
      expect(result.error.error).toBe("Unauthorized.");
    }
  });

  it("returns 403 when elapsed time exceeds threshold", async () => {
    const created = new Date(NOW - 900_001).toISOString(); // 15 min + 1 ms ago
    const fetchSession = vi.fn().mockResolvedValue(ok(session(created)));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, 900_000);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.error).toBe("Interview time has expired.");
    }
  });

  it("returns ok(session) when elapsed time equals threshold", async () => {
    const created = new Date(NOW - 900_000).toISOString(); // exactly 15 min ago
    const s = session(created);
    const fetchSession = vi.fn().mockResolvedValue(ok(s));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, 900_000);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.id).toBe(SESSION_ID);
  });

  it("returns ok(session) when elapsed time is under threshold", async () => {
    const created = new Date(NOW - 1000).toISOString(); // 1 s ago
    const s = session(created);
    const fetchSession = vi.fn().mockResolvedValue(ok(s));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, 900_000);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.id).toBe(SESSION_ID);
  });
});
