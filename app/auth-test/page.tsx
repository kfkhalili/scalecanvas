"use client";

import { createBrowserClientInstance } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

const AUTH_TEST_PATH = "/auth-test";
const LOG_PREFIX = "[auth-test]";

function getRedirectTo(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(AUTH_TEST_PATH)}`;
}

function GoogleIcon(): React.ReactElement {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function AuthTestPage(): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createBrowserClientInstance(), []);

  useEffect(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    console.log(LOG_PREFIX, "page_load", { pathname: AUTH_TEST_PATH, url });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log(LOG_PREFIX, "getSession_result", {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        error: error?.message ?? null,
      });
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(LOG_PREFIX, "onAuthStateChange", {
        event,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignIn(): Promise<void> {
    const redirectTo = getRedirectTo();
    console.log(LOG_PREFIX, "signIn_redirectTo", { redirectTo });
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  async function handleLogout(): Promise<void> {
    console.log(LOG_PREFIX, "logout");
    await supabase.auth.signOut();
    window.location.href = AUTH_TEST_PATH;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Auth test (minimal)</h1>
      <p className="text-xs text-gray-500">
        Check console for <code className="rounded bg-gray-100 px-1">{LOG_PREFIX}</code> logs.
      </p>
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600">
            Logged in as <span className="font-medium">{user.email ?? user.id}</span>
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300"
          >
            Log out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      )}
    </main>
  );
}
