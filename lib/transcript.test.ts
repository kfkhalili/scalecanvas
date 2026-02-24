import { describe, it, expect } from "vitest";
import { transcriptToPublic, mergeTranscript } from "./transcript";
import type { DbSessionTranscript } from "@/lib/database.aliases";
import type { TranscriptEntry } from "@/lib/types";

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

describe("mergeTranscript", () => {
  it("appends entry immutably (returns new array)", () => {
    const prev: TranscriptEntry[] = [
      { id: "t-1", sessionId: "s", role: "user", content: "A", createdAt: "2026-01-01T00:00:00Z" },
    ];
    const next: TranscriptEntry = {
      id: "t-2",
      sessionId: "s",
      role: "assistant",
      content: "B",
      createdAt: "2026-01-01T00:00:01Z",
    };
    const result = mergeTranscript(prev, next);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("A");
    expect(result[1].content).toBe("B");
    expect(prev).toHaveLength(1);
  });
});
