"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, SquarePen } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useSessionStore } from "@/stores/sessionStore";
import { createSessionApi, fetchSessions } from "@/services/sessionsClient";
import { SessionSelector } from "@/components/chat/SessionSelector";

const SIDEBAR_OPEN = 260;
const SIDEBAR_CLOSED = 52;

type CollapsibleSidebarProps = {
  isAnonymous?: boolean;
};

export function CollapsibleSidebar({
  isAnonymous = false,
}: CollapsibleSidebarProps): React.ReactElement {
  const router = useRouter();
  const { open, toggle, hydrate } = useSidebarStore();
  const { setCurrentSessionId, setSessions } = useSessionStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
    </nav>
  );
}
