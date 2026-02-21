import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import {
  getSessionIfWithinTimeLimit,
  timeLimitForSession,
  TRIAL_TIME_LIMIT_MS,
  PAID_TIME_LIMIT_MS,
} from "./chatGuardrails";
import type { Session } from "@/lib/types";

const SESSION_ID = "session-1";
const USER_ID = "user-1";
const OTHER_USER_ID = "user-999";
const NOW = 1_000_000_000_000;

function session(createdAt: string, overrides?: Partial<Session>): Session {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    title: null,
    status: "active",
    isTrial: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("timeLimitForSession", () => {
  it("returns 15 min for trial sessions", () => {
    expect(timeLimitForSession(session("", { isTrial: true }))).toBe(TRIAL_TIME_LIMIT_MS);
  });

  it("returns 60 min for paid sessions", () => {
    expect(timeLimitForSession(session("", { isTrial: false }))).toBe(PAID_TIME_LIMIT_MS);
  });
});

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
    const result = await getSessionIfWithinTimeLimit(fetchSession, undefined, USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(401);
      expect(result.error.error).toBe("Unauthorized.");
    }
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("returns 401 when sessionId is empty string", async () => {
    const fetchSession = vi.fn();
    const result = await getSessionIfWithinTimeLimit(fetchSession, "", USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.status).toBe(401);
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("returns 401 when fetchSession returns err", async () => {
    const fetchSession = vi.fn().mockResolvedValue(err({ message: "Not found" }));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(401);
      expect(result.error.error).toBe("Unauthorized.");
    }
  });

  it("returns 403 when userId does not match session owner", async () => {
    const created = new Date(NOW - 1000).toISOString();
    const fetchSession = vi.fn().mockResolvedValue(ok(session(created)));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, OTHER_USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.error).toBe("Forbidden.");
    }
  });

  it("returns 403 when session is terminated", async () => {
    const created = new Date(NOW - 1000).toISOString();
    const fetchSession = vi
      .fn()
      .mockResolvedValue(ok(session(created, { status: "terminated" })));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.error).toBe("Session has been terminated.");
    }
  });

  it("returns 403 when paid session exceeds 60-min limit", async () => {
    const created = new Date(NOW - PAID_TIME_LIMIT_MS - 1).toISOString();
    const fetchSession = vi
      .fn()
      .mockResolvedValue(ok(session(created, { isTrial: false })));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.error).toBe("Interview time has expired.");
    }
  });

  it("returns 403 when trial session exceeds 15-min limit", async () => {
    const created = new Date(NOW - TRIAL_TIME_LIMIT_MS - 1).toISOString();
    const fetchSession = vi
      .fn()
      .mockResolvedValue(ok(session(created, { isTrial: true })));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.error).toBe("Interview time has expired.");
    }
  });

  it("returns ok for paid session within 60-min limit", async () => {
    const created = new Date(NOW - PAID_TIME_LIMIT_MS + 1000).toISOString();
    const s = session(created, { isTrial: false });
    const fetchSession = vi.fn().mockResolvedValue(ok(s));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.id).toBe(SESSION_ID);
  });

  it("returns ok for trial session within 15-min limit", async () => {
    const created = new Date(NOW - 1000).toISOString();
    const s = session(created, { isTrial: true });
    const fetchSession = vi.fn().mockResolvedValue(ok(s));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.id).toBe(SESSION_ID);
  });

  it("returns ok when elapsed equals threshold exactly (paid)", async () => {
    const created = new Date(NOW - PAID_TIME_LIMIT_MS).toISOString();
    const s = session(created, { isTrial: false });
    const fetchSession = vi.fn().mockResolvedValue(ok(s));
    const result = await getSessionIfWithinTimeLimit(fetchSession, SESSION_ID, USER_ID);
    expect(result.isOk()).toBe(true);
  });
});
