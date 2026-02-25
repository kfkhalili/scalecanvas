import { Effect, Option } from "effect";
import { whenRight } from "@/lib/optionHelpers";
import type { Session } from "@/lib/types";

export type BootstrapContext = {
  readonly hasAnonymousChat: boolean;
  readonly hasAttemptedEval: boolean;
  readonly questionTitle: Option.Option<string>;
};

export type BootstrapAction =
  | { type: "redirect_login" }
  | { type: "resume_or_idle" }
  | { type: "deduct_and_handoff" };

/**
 * Pure decision function: given the bootstrap context, returns the action
 * PostAuthRoot should take. Anonymous handoff always deducts one token (one trial = one session).
 */
export function decideBootstrapAction(
  hasSession: boolean,
  ctx: BootstrapContext
): BootstrapAction {
  if (!hasSession) {
    return { type: "redirect_login" };
  }
  if (!ctx.hasAnonymousChat) {
    return { type: "resume_or_idle" };
  }
  return { type: "deduct_and_handoff" };
}

export type BootstrapDeps = {
  fetchSessions: () => Effect.Effect<ReadonlyArray<Session>, { message: string }>;
  deductTokenAndCreateSession: () => Effect.Effect<string, { message: string }>;
  renameSession: (id: string, title: string) => Promise<void>;
  setPendingAuthHandoff: (sessionId: Option.Option<string>) => void;
  setHasAttemptedEval: (value: boolean) => void;
  redirectTo: (path: string) => void;
};

export async function executeBootstrapAction(
  action: BootstrapAction,
  ctx: BootstrapContext,
  deps: BootstrapDeps
): Promise<void> {
  switch (action.type) {
    case "redirect_login":
      deps.redirectTo("/login");
      return;
    case "resume_or_idle": {
      const fetchEither = await Effect.runPromise(
        Effect.either(deps.fetchSessions())
      );
      whenRight(fetchEither, (list) => {
        if (list.length > 0) deps.redirectTo(`/${list[0].id}`);
      });
      return;
    }
    case "deduct_and_handoff": {
      deps.setHasAttemptedEval(false);
      const deductEither = await Effect.runPromise(
        Effect.either(deps.deductTokenAndCreateSession())
      );
      whenRight(deductEither, (sessionId) => {
        if (Option.isSome(ctx.questionTitle))
          void deps.renameSession(sessionId, ctx.questionTitle.value);
        deps.setPendingAuthHandoff(Option.some(sessionId));
      });
      return;
    }
  }
}
