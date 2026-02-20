"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, SquarePen, Settings, Monitor, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useSessionStore } from "@/stores/sessionStore";
import { createSessionApi, fetchSessions } from "@/services/sessionsClient";
import { SessionSelector } from "@/components/chat/SessionSelector";

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
  const router = useRouter();
  const { open, toggle, hydrate } = useSidebarStore();
  const { setCurrentSessionId, setSessions } = useSessionStore();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  const handleNewSession = (): void => {
    if (isAnonymous) {
      router.push("/");
      return;
    }
    createSessionApi(null).then((result) => {
      result.match(
        (session) => {
          setCurrentSessionId(session.id);
          router.push(`/${session.id}`);
          fetchSessions().then((r) =>
            r.match((list) => setSessions(list), () => {})
          );
        },
        () => {}
      );
    });
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
        <button
          type="button"
          onClick={handleNewSession}
          className="flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none"
        >
          <SquarePen className="h-5 w-5 shrink-0" />
          <span className="overflow-hidden">New session</span>
        </button>
      </div>

      <div
        className={`mt-4 flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-150 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <SessionSelector isAnonymous={isAnonymous} />
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
