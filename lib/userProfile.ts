import type { User } from "@supabase/supabase-js";

export function getAvatarUrl(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta?.avatar_url && typeof meta.avatar_url === "string") return meta.avatar_url;
  return null;
}

export function getDisplayName(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name = meta?.full_name ?? meta?.name ?? meta?.user_name;
  return typeof name === "string" ? name : null;
}

export function getProviderLabel(user: User): string {
  const provider = user.app_metadata?.provider;
  if (provider === "google") return "Google Account";
  if (provider === "github") return "GitHub Account";
  return "Account";
}

export function getInitials(user: User): string {
  const name = getDisplayName(user);
  if (name) {
    const parts = name.split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}
