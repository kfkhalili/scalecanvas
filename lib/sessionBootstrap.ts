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
  | { type: "resume_or_idle" };

/**
 * Pure decision function: given the bootstrap context, returns the action
 * PostAuthRoot should take. Anonymous handoff always deducts one token (one trial = one session).
 */
export function decideBootstrapAction(
  hasSession: boolean
): BootstrapAction {
  if (!hasSession) {
    return { type: "redirect_login" };
  }
  return { type: "resume_or_idle" };
}

export type BootstrapDeps = {
  fetchSessions: () => Effect.Effect<ReadonlyArray<Session>, { message: string }>;
  redirectTo: (path: string) => void;
};

export async function executeBootstrapAction(
  action: BootstrapAction,
  ctx: BootstrapContext,
  deps: BootstrapDeps
): Promise<void> {
  switch (action.type) {
    case "redirect_login":
      deps.redirectTo("/");
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
  }
}
