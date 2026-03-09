/**
 * UUIDs for e2e users created via GoTrue admin API in beforeEach.
 * JWT sub must be a UUID so auth.uid() in claim_trial_and_create_session returns a valid id
 * and the profile (created by trigger on auth.users insert) exists.
 */
export const E2E_JOURNEY_USER_ID = "e2e00000-0000-4000-8000-000000000001";
export const E2E_JOURNEY_CONCLUSION_USER_ID = "e2e00000-0000-4000-8000-000000000002";
/** Used by the JWT-bypass smoke test in cross-auth-jwt.spec.ts. */
export const E2E_JWT_BYPASS_USER_ID = "e2e00000-0000-4000-8000-000000000003";
/** Used by handoff resilience tests (H1/H2/H3 fixes). */
export const E2E_HANDOFF_H3_USER_ID = "e2e00000-0000-4000-8000-000000000004";
export const E2E_HANDOFF_H1_USER_ID = "e2e00000-0000-4000-8000-000000000005";
export const E2E_HANDOFF_H2_USER_ID = "e2e00000-0000-4000-8000-000000000006";

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
