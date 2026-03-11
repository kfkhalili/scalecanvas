/**
 * UUIDs for e2e users created via GoTrue admin API in beforeEach.
 * JWT sub must be a UUID so auth.uid() in claim_trial_and_create_session returns a valid id
 * and the profile (created by trigger on auth.users insert) exists.
 */
export const E2E_JOURNEY_USER_ID = "e2e00000-0000-4000-8000-000000000001";
export const E2E_JOURNEY_CONCLUSION_USER_ID = "e2e00000-0000-4000-8000-000000000002";
/** Used by the JWT-bypass smoke test in cross-auth-jwt.spec.ts. */
export const E2E_JWT_BYPASS_USER_ID = "e2e00000-0000-4000-8000-000000000003";
/** Used by handoff resilience tests. */
export const E2E_HANDOFF_DEDUP_USER_ID = "e2e00000-0000-4000-8000-000000000004";
export const E2E_HANDOFF_CANVAS_USER_ID = "e2e00000-0000-4000-8000-000000000005";
export const E2E_HANDOFF_TRANSCRIPT_USER_ID = "e2e00000-0000-4000-8000-000000000006";

// ---------------------------------------------------------------------------
// Timeout constants (ms) — centralised so CI-slow adjustments are in one place.
// Prefer these over magic numbers in spec files.
// ---------------------------------------------------------------------------

/** Waiting for session URL redirect or handoff API response. */
export const TIMEOUT_NAVIGATION = 20_000;
/** Waiting for server-side persistence (canvas PUT, transcript batch, conclusion stream). */
export const TIMEOUT_SERVER = 30_000;
/** Waiting for a DOM element to become visible after render (nodes, buttons). */
export const TIMEOUT_VISIBLE = 10_000;
/** Quick UI checks (dialog confirm, empty-state assertion, attribute read). */
export const TIMEOUT_SHORT = 5_000;
/** Polling assertion after a UI action that should be near-instant (e.g. node count after blocked drag). */
export const TIMEOUT_POLL = 2_000;

/**
 * JWT bypass only works with local Supabase (same JWT secret as e2e/jwtBypass.ts).
 * With a hosted Supabase URL, the minted JWT won't verify and tests would timeout.
 */
export function isLocalSupabase(): boolean {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return true;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}
