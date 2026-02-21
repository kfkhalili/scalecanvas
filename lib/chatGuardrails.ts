import { ok, err, type Result } from "neverthrow";
import type { Session } from "@/lib/types";

export type GuardrailError = { status: 401 | 403; error: string };

export const TRIAL_TIME_LIMIT_MS = 900_000; // 15 minutes
export const PAID_TIME_LIMIT_MS = 3_600_000; // 60 minutes

export function timeLimitForSession(session: Session): number {
  return session.isTrial ? TRIAL_TIME_LIMIT_MS : PAID_TIME_LIMIT_MS;
}

/**
 * Validates session_id, session existence, ownership, status, and elapsed time.
 * The time limit is chosen automatically: 15 min for trial, 60 min for paid.
 */
export async function getSessionIfWithinTimeLimit(
  fetchSession: (sessionId: string) => Promise<Result<Session, { message: string }>>,
  sessionId: string | undefined,
  userId: string
): Promise<Result<Session, GuardrailError>> {
  if (sessionId == null || sessionId.trim() === "") {
    return err({ status: 401, error: "Unauthorized." });
  }
  const result = await fetchSession(sessionId);
  if (result.isErr()) {
    return err({ status: 401, error: "Unauthorized." });
  }
  const session = result.value;
  if (session.userId !== userId) {
    return err({ status: 403, error: "Forbidden." });
  }
  if (session.status === "terminated") {
    return err({ status: 403, error: "Session has been terminated." });
  }
  const elapsed = Date.now() - new Date(session.createdAt).getTime();
  if (elapsed > timeLimitForSession(session)) {
    return err({ status: 403, error: "Interview time has expired." });
  }
  return ok(session);
}
