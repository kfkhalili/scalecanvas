import { ok, err, type Result } from "neverthrow";
import type { Session } from "@/lib/types";

export type GuardrailError = { status: 401 | 403; error: string };

/**
 * Validates session_id, session existence, ownership, status, and elapsed time.
 * Use in the chat API route before invoking Bedrock.
 */
export async function getSessionIfWithinTimeLimit(
  fetchSession: (sessionId: string) => Promise<Result<Session, { message: string }>>,
  sessionId: string | undefined,
  userId: string,
  thresholdMs: number
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
  if (elapsed > thresholdMs) {
    return err({ status: 403, error: "Interview time has expired." });
  }
  return ok(session);
}
