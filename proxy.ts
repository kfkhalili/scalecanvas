import { Option } from "effect";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieToSet } from "@/lib/cookie.types";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookieName";

const UUID_SEGMENT = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProtectedPath(pathname: string): boolean {
  return UUID_SEGMENT.test(pathname);
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WEBHOOK_PATHS = ["/api/webhooks/"];

function requiresOriginCheck(pathname: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method)) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !WEBHOOK_PATHS.some((wp) => pathname.startsWith(wp));
}

function originMatchesHost(
  origin: Option.Option<string>,
  host: Option.Option<string>
): boolean {
  return Option.match(origin, {
    onNone: () => false,
    onSome: (o) =>
      Option.match(host, {
        onNone: () => false,
        onSome: (h) => {
          try {
            return new URL(o).host === h;
          } catch {
            return false;
          }
        },
      }),
  });
}

export async function proxy(request: NextRequest) {
  // ── 1. CSRF / same-origin check for mutation API routes ─────────────────
  if (requiresOriginCheck(request.nextUrl.pathname, request.method)) {
    const origin = Option.fromNullable(request.headers.get("origin"));
    const host = Option.fromNullable(request.headers.get("host"));
    if (!originMatchesHost(origin, host)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const envOpt = Option.all([
    Option.fromNullable(process.env.NEXT_PUBLIC_SUPABASE_URL),
    Option.fromNullable(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY),
  ]);
  if (Option.isNone(envOpt)) {
    return new NextResponse("Server misconfiguration", { status: 500 });
  }
  const [url, key] = envOpt.value;

  // ── 2. Session cookie refresh (SOTA pattern) ─────────────────────────────
  //
  // supabaseResponse must be reassigned inside setAll so that when the SDK
  // writes a refreshed token it updates BOTH the outgoing request object
  // (so downstream Server Components see the new token in the same render)
  // AND the response (so the browser receives the updated cookie).
  //
  // Do NOT place any code between createServerClient and getClaims().
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookieOptions: { name: getSupabaseAuthCookieName(url) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Write to the request so Server Components in this render see
        // the refreshed token.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Recreate the response with the updated request, then write to it
        // so the browser receives the Set-Cookie header.
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options ?? {})
        );
      },
    },
  });

  // getClaims() performs local JWT validation (signature + expiry) and
  // triggers a silent token refresh when the access token is near expiry.
  // It does NOT call GoTrue — API routes use getUser() for that.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims != null;

  // ── 3. Protect UUID-segment routes (/[sessionId]) ────────────────────────
  if (isProtectedPath(request.nextUrl.pathname) && !isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any refreshed cookies onto the redirect response so the browser
    // receives them even on this early return path.
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirectResponse.cookies.set(c.name, c.value));
    return redirectResponse;
  }

  // IMPORTANT: return supabaseResponse unchanged so cookies propagate.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
