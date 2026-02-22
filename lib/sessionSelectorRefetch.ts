/**
 * Pure predicate: should SessionSelector call loadSessions when currentSessionId
 * is set by the URL but not yet in the sessions list (e.g. after handoff).
 * Used to avoid refetch loops by passing lastRefetchedForSessionId.
 */
export function shouldRefetchSessionsForCurrentSession(
  currentSessionId: string | null,
  sessions: ReadonlyArray<{ id: string }>,
  lastRefetchedForSessionId: string | null,
  isAnonymous: boolean
): boolean {
  if (isAnonymous || currentSessionId == null) return false;
  if (sessions.some((s) => s.id === currentSessionId)) return false;
  if (lastRefetchedForSessionId === currentSessionId) return false;
  return true;
}
