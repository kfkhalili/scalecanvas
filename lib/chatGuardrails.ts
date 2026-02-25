import { Effect, Option, pipe } from "effect";
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
export function getSessionIfWithinTimeLimit(
  fetchSession: (sessionId: string) => Effect.Effect<Session, { message: string }>,
  sessionIdOpt: Option.Option<string>,
  userId: string
): Effect.Effect<Session, GuardrailError> {
  return Option.match(sessionIdOpt, {
    onNone: () => Effect.fail({ status: 401, error: "Unauthorized." }),
    onSome: (sessionId) => {
      if (sessionId.trim() === "") {
        return Effect.fail({ status: 401, error: "Unauthorized." });
      }
      return pipe(
        fetchSession(sessionId),
        Effect.mapError(() => ({ status: 401 as const, error: "Unauthorized." })),
        Effect.flatMap((session) => {
          if (session.userId !== userId) {
            return Effect.fail({ status: 403 as const, error: "Forbidden." });
          }
          if (session.status === "terminated") {
            return Effect.fail({
              status: 403 as const,
              error: "Session has been terminated.",
            });
          }
          const elapsed = Date.now() - new Date(session.createdAt).getTime();
          if (elapsed > timeLimitForSession(session)) {
            return Effect.fail({
              status: 403 as const,
              error: "Interview time has expired.",
            });
          }
          return Effect.succeed(session);
        })
      );
    },
  });
}
