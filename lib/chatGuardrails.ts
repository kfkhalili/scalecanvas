import { Effect, Option, pipe } from "effect";
import type { Session } from "@/lib/types";

export type GuardrailError = { status: 401 | 403; error: string };

export const TRIAL_TIME_LIMIT_MS = 900_000; // 15 minutes
export const PAID_TIME_LIMIT_MS = 3_600_000; // 60 minutes

export function timeLimitForSession(session: Session): number {
  return session.isTrial ? TRIAL_TIME_LIMIT_MS : PAID_TIME_LIMIT_MS;
}

/**
 * Remaining interview time in ms (can be negative if over limit).
 * Used for client-side countdown display.
 */
export function remainingMs(session: Session): number {
  const limit = timeLimitForSession(session);
  const elapsed = Date.now() - new Date(session.createdAt).getTime();
  return limit - elapsed;
}

/** Format milliseconds as MM:SS for countdown display. */
export function formatRemainingMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export type TimerDisplay = {
  timeLabel: string;
  isElapsed: boolean;
  elapsedMessage?: string;
};

/**
 * Returns timer UI state from remaining ms. Stops at 0:00; when elapsed
 * returns message that time has elapsed and interview is concluded.
 */
export function getTimerDisplay(remainingMsValue: number): TimerDisplay {
  if (remainingMsValue <= 0) {
    return {
      timeLabel: "0:00",
      isElapsed: true,
      elapsedMessage: "Time has elapsed. Interview concluded.",
    };
  }
  return {
    timeLabel: formatRemainingMs(remainingMsValue),
    isElapsed: false,
  };
}

/**
 * Stable key for countdown effect (id + createdAt + isTrial) so the effect
 * only re-runs when session identity or time-relevant fields change, not
 * when the session object reference changes.
 */
export function countdownEffectKey(
  session:
    | Pick<Session, "id" | "createdAt" | "isTrial">
    | undefined
): string | null {
  if (!session) return null;
  return `${session.id}:${session.createdAt}:${session.isTrial}`;
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
