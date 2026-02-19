import { describe, it, expect } from "vitest";
import { sessionToPublic } from "./session";
import type { DbInterviewSession } from "@/lib/database.types";

describe("sessionToPublic", () => {
  it("maps DbInterviewSession to Session (camelCase)", () => {
    const db: DbInterviewSession = {
      id: "sess-1",
      user_id: "user-1",
      title: "My session",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    expect(sessionToPublic(db)).toEqual({
      id: "sess-1",
      userId: "user-1",
      title: "My session",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("handles null title", () => {
    const db: DbInterviewSession = {
      id: "sess-2",
      user_id: "user-2",
      title: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(sessionToPublic(db).title).toBeNull();
  });
});
