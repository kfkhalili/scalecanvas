import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPathPrefixes = ["/dashboard", "/interview"];

function isProtectedPath(pathname: string): boolean {
  return protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    return response;
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
          options: Record<string, string | number | boolean | undefined>;
        }>
      ): void {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" });
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
