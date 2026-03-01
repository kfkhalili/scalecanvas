import { Option } from "effect";

/** Parameters for deciding whether to trigger the Bedrock opening request (signed-in token path). */
export type ShouldTriggerOpeningParams = {
  sessionId: string | undefined;
  initialEntriesLength: number;
  isAnonymous: boolean;
  isTrial: boolean;
  /** Session id for which opening was already requested, if any. Use Option in domain; pass Option.fromNullable(ref.current) at call site. */
  openingRequestedSessionIdOpt: Option.Option<string>;
};

/**
 * True when we should send the opening request: signed-in, token session (not trial),
 * empty transcript, and not already requested. Trial sessions never get opening; first message uses design phase.
 */
export function shouldTriggerOpening(params: ShouldTriggerOpeningParams): boolean {
  if (params.sessionId === undefined) return false;
  if (params.isAnonymous) return false;
  if (params.isTrial) return false;
  if (params.initialEntriesLength > 0) return false;
  const alreadyRequestedForThisSession = Option.match(params.openingRequestedSessionIdOpt, {
    onNone: () => false,
    onSome: (id) => id === params.sessionId,
  });
  if (alreadyRequestedForThisSession) return false;
  return true;
}
