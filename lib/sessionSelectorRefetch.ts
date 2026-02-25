import { Option } from "effect";

/**
 * Pure predicate: should SessionSelector call loadSessions when currentSessionId
 * is set by the URL but not yet in the sessions list (e.g. after handoff).
 * Used to avoid refetch loops by passing lastRefetchedForSessionId.
 */
export function shouldRefetchSessionsForCurrentSession(
  currentSessionId: Option.Option<string>,
  sessions: ReadonlyArray<{ id: string }>,
  lastRefetchedForSessionId: Option.Option<string>,
  isAnonymous: boolean
): boolean {
  if (isAnonymous) return false;
  return Option.match(currentSessionId, {
    onNone: () => false,
    onSome: (cid) => {
      if (sessions.some((s) => s.id === cid)) return false;
      return Option.match(lastRefetchedForSessionId, {
        onNone: () => true,
        onSome: (last) => last !== cid,
      });
    },
  });
}
