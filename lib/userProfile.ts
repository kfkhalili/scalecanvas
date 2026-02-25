import { Option } from "effect";
import type { User } from "@supabase/supabase-js";

export function getAvatarUrl(user: User): Option.Option<string> {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta?.avatar_url && typeof meta.avatar_url === "string") {
    return Option.some(meta.avatar_url);
  }
  return Option.none();
}

export function getDisplayName(user: User): Option.Option<string> {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name = meta?.full_name ?? meta?.name ?? meta?.user_name;
  return typeof name === "string" ? Option.some(name) : Option.none();
}

export function getProviderLabel(user: User): string {
  const provider = user.app_metadata?.provider;
  if (provider === "google") return "Google Account";
  if (provider === "github") return "GitHub Account";
  return "Account";
}

export function getInitials(user: User): string {
  return Option.match(getDisplayName(user), {
    onNone: () => (user.email?.[0] ?? "?").toUpperCase(),
    onSome: (name) => {
      const parts = name.split(/\s+/);
      return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
    },
  });
}
