import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import type { CookieToSet } from "@/lib/cookie.types";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookieName";

export type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerClientInstance>
>;

export async function createServerClientInstance() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
    );
  }
  return createServerClient<Database>(url, key, {
    cookieOptions: { name: getSupabaseAuthCookieName(url) },
    cookies: {
      getAll(): { name: string; value: string }[] {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]): void {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options ?? {});
          });
        } catch {
          // setAll from Server Component; middleware will refresh session
        }
      },
    },
  });
}
