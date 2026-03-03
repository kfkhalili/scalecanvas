import { createServerClientInstance } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LOG_PREFIX = "[auth-callback]";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";

  console.log(LOG_PREFIX, "request", { hasCode: !!code, next, origin });

  if (code) {
    const supabase = await createServerClientInstance();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    console.log(LOG_PREFIX, "exchangeCodeForSession", {
      ok: !error,
      error: error?.message ?? null,
      hasSession: !!data?.session,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  console.log(LOG_PREFIX, "redirect_error", { next: "/?error=auth_callback_error" });
  return NextResponse.redirect(`${origin}/?error=auth_callback_error`);
}
