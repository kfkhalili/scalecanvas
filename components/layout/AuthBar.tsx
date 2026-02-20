"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X, LogOut } from "lucide-react";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { getAvatarUrl, getDisplayName, getProviderLabel, getInitials } from "@/lib/userProfile";
import type { User } from "@supabase/supabase-js";

type AuthBarProps = {
  isAnonymous?: boolean;
};

export function AuthBar({ isAnonymous = false }: AuthBarProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAnonymous) return;
    const supabase = createBrowserClientInstance();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [isAnonymous]);

  useEffect(() => {
    if (!popoverOpen) return;
    const close = (e: MouseEvent): void => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (avatarRef.current?.contains(e.target as Node)) return;
      setPopoverOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [popoverOpen]);

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

  const avatarUrl = getAvatarUrl(user);
  const displayName = getDisplayName(user);
  const providerLabel = getProviderLabel(user);
  const initials = getInitials(user);
  const email = user.email ?? "";

  const handleSignOut = async (): Promise<void> => {
    const supabase = createBrowserClientInstance();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const togglePopover = (): void => {
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setPopoverOpen(true);
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-3 z-10">
      {/* Avatar button with hover tooltip */}
      <div className="group relative">
        <button
          ref={avatarRef}
          type="button"
          onClick={togglePopover}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-foreground/10 transition-shadow hover:ring-foreground/25 focus:outline-none"
          aria-label="Account menu"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-blue-600 text-xs font-semibold text-white">
              {initials}
            </span>
          )}
        </button>

        {/* Hover tooltip */}
        <div className="pointer-events-none absolute right-0 top-full mt-2 hidden whitespace-nowrap rounded-lg bg-popover px-3 py-2 text-xs shadow-lg group-hover:block">
          <div className="font-medium text-foreground">{providerLabel}</div>
          {displayName && <div className="text-foreground/70">{displayName}</div>}
          <div className="text-foreground/70">{email}</div>
        </div>
      </div>

      {/* Click popover (portal) */}
      {popoverOpen &&
        popoverPos != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[200] w-[300px] rounded-2xl border bg-popover shadow-xl"
            style={{ top: popoverPos.top, right: popoverPos.right }}
          >
            {/* Header with email + close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm text-foreground/70">{email}</span>
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Avatar + greeting */}
            <div className="flex flex-col items-center gap-2 px-5 py-4">
              <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-foreground/10">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-blue-600 text-lg font-semibold text-white">
                    {initials}
                  </span>
                )}
              </div>
              {displayName && (
                <p className="text-lg text-foreground/80">
                  Hi, {displayName.split(/\s+/)[0]}!
                </p>
              )}
            </div>

            {/* Sign out */}
            <div className="border-t px-3 py-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
