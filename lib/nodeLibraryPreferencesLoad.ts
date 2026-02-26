/**
 * Decides whether to run the "load preferences from API" flow when the URL
 * has no providers param. Used by NodeLibrary to avoid fetching more than once
 * when the effect re-runs (e.g. auth/session re-renders with Google login).
 *
 * Returns true only when we should fetch: no providers in URL, not anonymous,
 * and we have not already fetched for this "no providers" state.
 */
export function shouldFetchPreferencesWhenNoProviders(
  hasProvidersInUrl: boolean,
  isAnonymous: boolean,
  hasAlreadyFetchedWhenNoProviders: boolean
): boolean {
  if (hasProvidersInUrl || isAnonymous || hasAlreadyFetchedWhenNoProviders) {
    return false;
  }
  return true;
}
