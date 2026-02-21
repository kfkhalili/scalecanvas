import { ok, err, type Result } from "neverthrow";
import type { Session } from "@/lib/types";

export type GuardrailError = { status: 401 | 403; error: string };

/**
 * Validates session_id and session existence, then checks elapsed time.
 * Use in the chat API route before invoking Bedrock.
 */
export async function getSessionIfWithinTimeLimit(
  fetchSession: (sessionId: string) => Promise<Result<Session, { message: string }>>,
  sessionId: string | undefined,
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
  const elapsed = Date.now() - new Date(session.createdAt).getTime();
  if (elapsed > thresholdMs) {
    return err({ status: 403, error: "Interview time has expired." });
  }
  return ok(session);
}
