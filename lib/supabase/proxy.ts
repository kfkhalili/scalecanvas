/**
 * Supabase session refresh helper for the Next.js Proxy (proxy.ts).
 *
 * Uses supabase.auth.getClaims() — fast local JWT validation (signature +
 * expiration) — which is the SOTA pattern for proxy/middleware to keep cookies
 * fresh without a round-trip to GoTrue on every request.
 *
 * API routes that need authoritative session validation continue to use
 * getUser() (which verifies with GoTrue), so there is no security regression.
 *
 * Reference:
 * https://supabase.com/docs/guides/auth/server-side/creating-a-client#hook-up-proxy
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import type { CookieToSet } from "@/lib/cookie.types";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookieName";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Must be created fresh on every request (Fluid compute / serverless).
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    // If env vars are missing, pass through without crashing.
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookieOptions: { name: getSupabaseAuthCookieName(url) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Write refreshed cookies to the outgoing request (so downstream
        // Server Components see them) AND to the response (so the browser
        // receives the updated tokens).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options ?? {})
        );
      },
    },
  });

  // DO NOT place any code between createServerClient and getClaims().
  // Even a small mistake here can cause users to be randomly logged out.
  //
  // getClaims() performs local JWT validation (signature + expiry) and
  // triggers a token refresh when needed. It does not call GoTrue.
  await supabase.auth.getClaims();

  // IMPORTANT: Return supabaseResponse as-is so the refreshed cookies are
  // propagated to the browser. If you need to return a different response,
  // copy the cookies over:
  //   const res = NextResponse.redirect(url)
  //   supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c))
  //   return res
  return supabaseResponse;
}
