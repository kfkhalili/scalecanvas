import type { Session } from "@/lib/types";
import type { DbInterviewSession } from "@/lib/database.types";

export function sessionToPublic(db: DbInterviewSession): Session {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}
