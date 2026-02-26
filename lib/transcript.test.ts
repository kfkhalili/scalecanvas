import { describe, it, expect } from "vitest";
import { transcriptToPublic } from "./transcript";
import type { DbSessionTranscript } from "@/lib/database.aliases";

describe("transcriptToPublic", () => {
  it("maps DbSessionTranscript to TranscriptEntry (camelCase)", () => {
    const db: DbSessionTranscript = {
      id: "t-1",
      session_id: "sess-1",
      role: "user",
      content: "Hello",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(transcriptToPublic(db)).toEqual({
      id: "t-1",
      sessionId: "sess-1",
      role: "user",
      content: "Hello",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("handles assistant role", () => {
    const db: DbSessionTranscript = {
      id: "t-2",
      session_id: "sess-1",
      role: "assistant",
      content: "Hi there",
      created_at: "2026-01-01T00:00:01Z",
    };
    expect(transcriptToPublic(db).role).toBe("assistant");
  });
});
