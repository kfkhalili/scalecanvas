import { Effect, Either, Option } from "effect";
import { whenRight } from "@/lib/optionHelpers";
import type { Session } from "@/lib/types";

export type BootstrapContext = {
  readonly hasAnonymousChat: boolean;
  readonly hasAttemptedEval: boolean;
  readonly questionTitle: Option.Option<string>;
};

export type HandoffResult =
  | { created: true; session_id: string }
  | { created: false };

export type BootstrapAction =
  | { type: "redirect_login" }
  | { type: "handoff" }
  | { type: "resume_or_idle" };

/**
 * Pure decision function: maps the bootstrap context to the action PostAuthRoot
 * should take. No session → redirect to login. Anonymous chat present → run
 * BFF handoff. Otherwise → resume the most recent session or idle.
 */
export function decideBootstrapAction(
  hasSession: boolean,
  hasAnonymousChat: boolean
): BootstrapAction {
  if (!hasSession) return { type: "redirect_login" };
  if (hasAnonymousChat) return { type: "handoff" };
  return { type: "resume_or_idle" };
}

export type BootstrapDeps = {
  fetchSessions: () => Effect.Effect<ReadonlyArray<Session>, { message: string }>;
  redirectTo: (path: string) => void;
  doHandoff: (
    questionTitle: Option.Option<string>
  ) => Effect.Effect<HandoffResult, { message: string }>;
  setPendingAuthHandoff: (sessionId: string) => void;
  clearAnonymousState: () => void;
};

async function redirectToMostRecentSession(deps: BootstrapDeps): Promise<void> {
  const either = await Effect.runPromise(Effect.either(deps.fetchSessions()));
  whenRight(either, (list) => {
    if (list.length > 0) deps.redirectTo(`/${list[0].id}`);
  });
}

export async function executeBootstrapAction(
  action: BootstrapAction,
  ctx: BootstrapContext,
  deps: BootstrapDeps
): Promise<void> {
  switch (action.type) {
    case "redirect_login":
      deps.redirectTo("/");
      return;
    case "resume_or_idle":
      await redirectToMostRecentSession(deps);
      return;
    case "handoff": {
      const handoffEither = await Effect.runPromise(
        Effect.either(deps.doHandoff(ctx.questionTitle))
      );
      if (Either.isRight(handoffEither)) {
        const result = handoffEither.right;
        if (result.created && result.session_id) {
          deps.setPendingAuthHandoff(result.session_id);
          deps.redirectTo(`/${result.session_id}`);
          return;
        }
        // Trial already claimed — clear anonymous state and fall through to resume.
      }
      // Handoff failed or trial not eligible — clear state, redirect to most recent.
      deps.clearAnonymousState();
      await redirectToMostRecentSession(deps);
      return;
    }
  }
}
