import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClientInstance() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
    );
  }
  return createServerClient(url, key, {
    cookies: {
      getAll(): { name: string; value: string }[] {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, string | number | boolean | Date> }[]): void {
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
