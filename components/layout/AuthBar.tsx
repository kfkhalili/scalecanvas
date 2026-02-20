"use client";

import { useEffect, useState } from "react";
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

  if (isAnonymous) return <></>;

  if (!user) return <></>;

  // Signed-in UI (avatar + account menu) is shown in the left sidebar; nothing in top bar
  return <></>;
}
