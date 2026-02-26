import type { TranscriptEntry } from "@/lib/types";
import type { DbSessionTranscript } from "@/lib/database.aliases";

function narrowRole(role: string): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

export function transcriptToPublic(db: DbSessionTranscript): TranscriptEntry {
  return {
    id: db.id,
    sessionId: db.session_id,
    role: narrowRole(db.role),
    content: db.content,
    createdAt: db.created_at,
  };
}
