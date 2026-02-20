"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import {
  fetchSessions,
  deleteSessionApi,
  renameSessionApi,
} from "@/services/sessionsClient";
import { useEffect, useCallback, useState, useRef } from "react";

function SkeletonRows(): React.ReactElement {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-2.5 py-2.5" aria-hidden>
          <div
            className="h-4 animate-pulse rounded-full bg-muted"
            style={{ width: `${60 + i * 12}%` }}
          />
        </li>
      ))}
    </>
  );
}

type SessionSelectorProps = {
  isAnonymous?: boolean;
};

export function SessionSelector({
  isAnonymous = false,
}: SessionSelectorProps): React.ReactElement {
  const router = useRouter();
  const { currentSessionId, sessions, setCurrentSessionId, setSessions } =
    useSessionStore();
  const [loading, setLoading] = useState(!isAnonymous);

  const loadSessions = useCallback(() => {
    if (isAnonymous) return;
    fetchSessions().then((result) => {
      result.match(
        (list) => setSessions(list),
        () => setSessions([])
      );
      setLoading(false);
    });
  }, [isAnonymous, setSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelect = (sessionId: string): void => {
    setCurrentSessionId(sessionId);
    router.push(`/${sessionId}`);
  };

  /* ---- inline rename state ---- */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = (sessionId: string, currentTitle: string): void => {
    setMenuSessionId(null);
    setRenamingId(sessionId);
    setRenameValue(currentTitle);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = (): void => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    const id = renamingId;
    setRenamingId(null);
    if (!trimmed) return;
    renameSessionApi(id, trimmed).then((r) =>
      r.match(
        () =>
          fetchSessions().then((fr) =>
            fr.match(
              (list) => setSessions(list),
              () => {}
            )
          ),
        () => {}
      )
    );
  };

  const cancelRename = (): void => {
    setRenamingId(null);
  };

  /* ---- three-dot menu state ---- */
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDelete = (sessionId: string): void => {
    setMenuSessionId(null);
    deleteSessionApi(sessionId).then(() => {
      fetchSessions().then((r) =>
        r.match(
          (list) => {
            setSessions(list);
            if (sessionId === currentSessionId) {
              const next = list[0];
              if (next) {
                setCurrentSessionId(next.id);
                router.push(`/${next.id}`);
              } else {
                setCurrentSessionId(null);
                router.push("/");
              }
            }
          },
          () => {}
        )
      );
    });
  };

  const openMenu = (sessionId: string, el: HTMLButtonElement): void => {
    const rect = el.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: rect.right - 160 });
    setMenuSessionId(sessionId);
  };

  useEffect(() => {
    if (menuSessionId == null) {
      setMenuPosition(null);
      return;
    }
    const close = (e: MouseEvent): void => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuSessionId(null);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [menuSessionId]);

  const menuSession =
    menuSessionId != null
      ? sessions.find((s) => s.id === menuSessionId)
      : null;

  if (isAnonymous) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2.5">
        <h3 className="shrink-0 whitespace-nowrap px-2.5 pb-1 text-sm font-semibold text-foreground/60">
          Sessions
        </h3>
        <div className="px-2.5 py-3">
          <p className="text-sm leading-relaxed text-foreground/50">
            Sign in to start saving your sessions.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/50">
            Once you&apos;re signed in, you can access your recent sessions here.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2.5">
      {/* Section header */}
      <h3 className="shrink-0 whitespace-nowrap px-2.5 pb-1 text-sm font-semibold text-foreground/60">
        Sessions
      </h3>

      {/* Scrollable list */}
      <ul
        className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto"
        role="listbox"
        aria-label="Sessions"
      >
        {loading ? (
          <SkeletonRows />
        ) : sessions.length === 0 ? (
          <li className="whitespace-nowrap px-2.5 py-2.5 text-sm text-foreground/40">
            No sessions yet
          </li>
        ) : (
          sessions.map((s) => {
            const isCurrent = currentSessionId === s.id;
            const menuOpen = menuSessionId === s.id;
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={isCurrent}
                className="group"
                data-current={isCurrent || undefined}
              >
                <div
                  className={`flex w-full items-center rounded-full transition-colors ${
                    isCurrent
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted/60"
                  }`}
                >
                  {renamingId === s.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="min-w-0 flex-1 rounded bg-transparent px-2.5 py-2 text-sm text-foreground outline-none ring-1 ring-foreground/20 focus:ring-foreground/40"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelect(s.id)}
                      className="min-w-0 flex-1 truncate whitespace-nowrap px-2.5 py-2.5 text-left text-sm focus:outline-none"
                    >
                      {s.title ?? "Untitled"}
                    </button>
                  )}
                  {renamingId !== s.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuOpen) {
                          setMenuSessionId(null);
                        } else {
                          openMenu(s.id, e.currentTarget);
                        }
                      }}
                      aria-label="Session options"
                      aria-expanded={menuOpen}
                      className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/40 opacity-0 transition-all hover:bg-muted-foreground/10 hover:text-foreground focus:outline-none group-hover:opacity-100 group-data-[current]:opacity-100 data-[visible]:opacity-100"
                      data-visible={menuOpen || undefined}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Portal dropdown for three-dot menu */}
      {menuSession != null &&
        menuPosition != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-[160px] rounded-xl border bg-popover py-1.5 shadow-lg"
            role="menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                startRename(menuSession.id, menuSession.title ?? "Untitled")
              }
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground hover:bg-muted focus:outline-none"
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleDelete(menuSession.id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground hover:bg-muted focus:outline-none"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
