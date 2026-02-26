"use client";

import { Option } from "effect";
import { useEffect, useState } from "react";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthBarProps = {
  isAnonymous?: boolean;
};

export function AuthBar({ isAnonymous = false }: AuthBarProps): React.ReactElement {
  const [userOpt, setUserOpt] = useState<Option.Option<User>>(Option.none());

  useEffect(() => {
    if (isAnonymous) return;
    const supabase = createBrowserClientInstance();
    supabase.auth.getUser().then(({ data }) => setUserOpt(Option.fromNullable(data.user)));
  }, [isAnonymous]);

  if (isAnonymous) return <></>;

  if (Option.isNone(userOpt)) return <></>;

  // Signed-in UI (avatar + account menu) is shown in the left sidebar; nothing in top bar
  return <></>;
}
