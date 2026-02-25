import { describe, it, expect } from "vitest";
import { sessionToPublic, getSessionDisplayTitle } from "./session";
import type { DbInterviewSession } from "@/lib/database.aliases";

describe("sessionToPublic", () => {
  it("maps DbInterviewSession to Session (camelCase)", () => {
    const db: DbInterviewSession = {
      id: "sess-1",
      user_id: "user-1",
      title: "My session",
      status: "active",
      is_trial: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    expect(sessionToPublic(db)).toEqual({
      id: "sess-1",
      userId: "user-1",
      title: "My session",
      status: "active",
      isTrial: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("handles null title", () => {
    const db: DbInterviewSession = {
      id: "sess-2",
      user_id: "user-2",
      title: null,
      status: "active",
      is_trial: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(sessionToPublic(db).title).toBeNull();
  });
});

describe("getSessionDisplayTitle", () => {
  it("returns title when present", () => {
    expect(
      getSessionDisplayTitle({
        id: "x",
        userId: "u",
        title: "My Session",
        status: "active",
        isTrial: false,
        createdAt: "",
        updatedAt: "",
      })
    ).toBe("My Session");
  });

  it("returns Untitled when title is null", () => {
    expect(
      getSessionDisplayTitle({
        id: "x",
        userId: "u",
        title: null,
        status: "active",
        isTrial: false,
        createdAt: "",
        updatedAt: "",
      })
    ).toBe("Untitled");
  });
});
