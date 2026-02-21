import type { Result } from "neverthrow";
import type { Session } from "@/lib/types";

export type BootstrapContext = {
  readonly hasAnonymousChat: boolean;
  readonly hasAttemptedEval: boolean;
  readonly questionTitle: string | null;
};

export type BootstrapAction =
  | { type: "redirect_login" }
  | { type: "create_and_redirect" }
  | { type: "deduct_and_handoff" }
  | { type: "create_with_title_and_handoff" };

/**
 * Pure decision function: given the bootstrap context, returns the action
 * PostAuthRoot should take. Keeps business logic out of the component.
 */
export function decideBootstrapAction(
  hasSession: boolean,
  ctx: BootstrapContext
): BootstrapAction {
  if (!hasSession) {
    return { type: "redirect_login" };
  }
  if (!ctx.hasAnonymousChat) {
    return { type: "create_and_redirect" };
  }
  if (ctx.hasAttemptedEval) {
    return { type: "deduct_and_handoff" };
  }
  return { type: "create_with_title_and_handoff" };
}

export type BootstrapDeps = {
  createSession: (title?: string | null) => Promise<Result<Session, { message: string }>>;
  deductTokenAndCreateSession: () => Promise<Result<string, { message: string }>>;
  renameSession: (id: string, title: string) => Promise<void>;
  setPendingAuthHandoff: (sessionId: string) => void;
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
    case "create_and_redirect":
      (await deps.createSession()).match(
        (s) => deps.redirectTo(`/${s.id}`),
        () => deps.redirectTo("/login")
      );
      return;
    case "deduct_and_handoff":
      deps.setHasAttemptedEval(false);
      (await deps.deductTokenAndCreateSession()).match(
        (sessionId) => {
          if (ctx.questionTitle) deps.renameSession(sessionId, ctx.questionTitle);
          deps.setPendingAuthHandoff(sessionId);
        },
        () => deps.redirectTo("/login")
      );
      return;
    case "create_with_title_and_handoff":
      (await deps.createSession(ctx.questionTitle)).match(
        (s) => deps.setPendingAuthHandoff(s.id),
        () => deps.redirectTo("/login")
      );
      return;
  }
}
