import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions, CookieToSet } from "@/lib/cookie.types";

const UUID_SEGMENT = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProtectedPath(pathname: string): boolean {
  return UUID_SEGMENT.test(pathname);
}

function adaptCookieOptions(
  options: Record<string, string | number | boolean | undefined>
): CookieOptions {
  return {
    path: typeof options.path === "string" ? options.path : undefined,
    maxAge: typeof options.maxAge === "number" ? options.maxAge : undefined,
    httpOnly: options.httpOnly === true,
    secure: options.secure === true,
    sameSite:
      options.sameSite === "lax" || options.sameSite === "strict" || options.sameSite === "none"
        ? options.sameSite
        : undefined,
  };
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WEBHOOK_PATHS = ["/api/webhooks/"];

function requiresOriginCheck(pathname: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method)) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !WEBHOOK_PATHS.some((wp) => pathname.startsWith(wp));
}

function originMatchesHost(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (requiresOriginCheck(request.nextUrl.pathname, request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!originMatchesHost(origin, host)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    return new NextResponse("Server misconfiguration", { status: 500 });
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll(): { name: string; value: string }[] {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, string | number | boolean | undefined>;
        }>
      ): void {
        cookiesToSet.forEach(({ name, value, options }) => {
          const opts: CookieToSet["options"] = options
            ? adaptCookieOptions(options)
            : undefined;
          response.cookies.set(name, value, opts);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
