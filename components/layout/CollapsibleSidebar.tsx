"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Menu, SquarePen, Settings, Monitor, Sun, Moon, Check, LogIn, LogOut, X } from "lucide-react";
import { useTheme } from "next-themes";
import type { User } from "@supabase/supabase-js";
import { useSidebarStore } from "@/stores/sidebarStore";
import { SessionSelector } from "@/components/chat/SessionSelector";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { getAvatarUrl, getDisplayName, getInitials } from "@/lib/userProfile";
import { NewSessionButton } from "@/components/billing/NewSessionButton";

const SIDEBAR_OPEN = 260;
const SIDEBAR_CLOSED = 52;

type CollapsibleSidebarProps = {
  isAnonymous?: boolean;
};

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function CollapsibleSidebar({
  isAnonymous = false,
}: CollapsibleSidebarProps): React.ReactElement {
  const { open, toggle, hydrate } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPos, setAccountPos] = useState<{ bottom: number; left: number } | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAnonymous) return;
    const supabase = createBrowserClientInstance();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [isAnonymous]);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e: MouseEvent): void => {
      if (settingsMenuRef.current?.contains(e.target as Node)) return;
      if (settingsBtnRef.current?.contains(e.target as Node)) return;
      setSettingsOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [settingsOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (e: MouseEvent): void => {
      if (accountMenuRef.current?.contains(e.target as Node)) return;
      if (accountBtnRef.current?.contains(e.target as Node)) return;
      setAccountOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [accountOpen]);

  const toggleSettings = (): void => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (settingsBtnRef.current) {
      const rect = settingsBtnRef.current.getBoundingClientRect();
      setMenuPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setSettingsOpen(true);
  };

  const toggleAccount = (): void => {
    if (accountOpen) {
      setAccountOpen(false);
      return;
    }
    if (accountBtnRef.current) {
      const rect = accountBtnRef.current.getBoundingClientRect();
      setAccountPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setAccountOpen(true);
  };

  const handleSignOut = async (): Promise<void> => {
    const supabase = createBrowserClientInstance();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <nav
      className="flex h-full shrink-0 flex-col overflow-hidden bg-background transition-[width] duration-200 ease-out"
      style={{ width: open ? SIDEBAR_OPEN : SIDEBAR_CLOSED }}
    >
      <div className="flex shrink-0 items-center pl-1.5 pr-2.5 pt-3 pb-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Collapse menu" : "Expand menu"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted focus:outline-none"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="shrink-0 pl-1.5 pr-2.5 py-1">
        {isAnonymous ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="Sign in to start a session"
            className="flex h-10 w-full cursor-not-allowed items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-muted-foreground transition-colors focus:outline-none disabled:opacity-60"
          >
            <SquarePen className="h-5 w-5 shrink-0" />
            <span className="overflow-hidden">New session</span>
          </button>
        ) : (
          <NewSessionButton sidebarOpen={open} />
        )}
      </div>

      <div
        className={`mt-4 flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-150 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <SessionSelector isAnonymous={isAnonymous} />
      </div>

      <div className="shrink-0 pl-1.5 pr-2.5 py-1">
        {isAnonymous ? (
          <Link
            href="/login"
            className="flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
          >
            <LogIn className="h-5 w-5 shrink-0" />
            {open && <span className="overflow-hidden">Sign in</span>}
          </Link>
        ) : user ? (
          <>
            <button
              ref={accountBtnRef}
              type="button"
              onClick={toggleAccount}
              className="flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
              aria-label="Account menu"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-foreground/10">
                {(() => {
                  const avatarUrl = getAvatarUrl(user);
                  return avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-blue-600 text-[10px] font-semibold text-white">
                      {getInitials(user)}
                    </span>
                  );
                })()}
              </span>
              {open && (
                <span className="min-w-0 truncate text-left text-foreground/80">
                  {getDisplayName(user) ?? user.email ?? "Account"}
                </span>
              )}
            </button>
            {accountOpen &&
              accountPos != null &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={accountMenuRef}
                  className="fixed z-[200] w-56 rounded-xl border bg-popover py-1.5 shadow-xl"
                  style={{ bottom: accountPos.bottom, left: accountPos.left }}
                >
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="truncate text-sm text-foreground/70">{user.email}</span>
                    <button
                      type="button"
                      onClick={() => setAccountOpen(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign out
                  </button>
                </div>,
                document.body
              )}
          </>
        ) : null}
      </div>

      <div className="shrink-0 pl-1.5 pr-2.5 py-2">
        <button
          ref={settingsBtnRef}
          type="button"
          onClick={toggleSettings}
          className="flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className="overflow-hidden">Settings &amp; help</span>
        </button>
      </div>

      {settingsOpen &&
        menuPos != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={settingsMenuRef}
            className="fixed z-[200] w-56 rounded-xl border bg-popover py-1.5 shadow-xl"
            style={{ bottom: menuPos.bottom, left: menuPos.left }}
          >
            <div className="px-3 py-2 text-xs font-medium text-foreground/50">Theme</div>
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value);
                  setSettingsOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {theme === value && <Check className="h-4 w-4 shrink-0 text-blue-500" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </nav>
  );
}
