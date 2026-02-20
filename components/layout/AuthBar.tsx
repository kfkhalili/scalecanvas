"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthBarProps = {
  isAnonymous?: boolean;
};

export function AuthBar({ isAnonymous = false }: AuthBarProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isAnonymous) return;
    const supabase = createBrowserClientInstance();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [isAnonymous]);

  if (isAnonymous) {
    return (
      <div className="pointer-events-auto absolute right-4 top-3 z-10">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!user) return <></>;

  const handleSignOut = async (): Promise<void> => {
    const supabase = createBrowserClientInstance();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-3 z-10 flex items-center gap-3">
      <span className="text-xs text-foreground/50 hidden sm:inline">
        {user.email ?? user.id.slice(0, 8)}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-full px-3 py-1.5 text-sm text-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
      >
        Sign out
      </button>
    </div>
  );
}
