import type { Session } from "@/lib/types";
import type { DbInterviewSession } from "@/lib/database.aliases";

export function sessionToPublic(db: DbInterviewSession): Session {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    status: db.status,
    isTrial: db.is_trial,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function getSessionDisplayTitle(session: Session): string {
  return session.title ?? "Untitled";
}
