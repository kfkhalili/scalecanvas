/**
 * Derives the Supabase auth cookie/storage key from the project URL.
 * Must match what @supabase/ssr uses when cookieOptions.name is set, so the app
 * and e2e JWT bypass use the same cookie name.
 *
 * Pattern: sb-${ref}-auth-token
 * - https://PROJECT_REF.supabase.co → PROJECT_REF
 * - http://127.0.0.1:54321 or localhost → local
 * - other → hostname
 */
export function getSupabaseAuthCookieName(supabaseUrl: string): string {
  let ref: string;
  try {
    const u = new URL(supabaseUrl);
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".supabase.co")) {
      ref = host.slice(0, -".supabase.co".length);
    } else if (host === "127.0.0.1" || host === "localhost") {
      ref = "local";
    } else {
      ref = host;
    }
  } catch {
    ref = "local";
  }
  return `sb-${ref}-auth-token`;
}
