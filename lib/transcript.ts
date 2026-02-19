import type { TranscriptEntry } from "@/lib/types";
import type { DbSessionTranscript } from "@/lib/database.types";

export function transcriptToPublic(db: DbSessionTranscript): TranscriptEntry {
  return {
    id: db.id,
    sessionId: db.session_id,
    role: db.role,
    content: db.content,
    createdAt: db.created_at,
  };
}

export function mergeTranscript(
  prev: ReadonlyArray<TranscriptEntry>,
  next: TranscriptEntry
): TranscriptEntry[] {
  return [...prev, next];
}
