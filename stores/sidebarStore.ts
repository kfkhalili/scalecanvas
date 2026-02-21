const SIDEBAR_STORAGE_KEY = "scalecanvas-sidebar-open";

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

function setStored(open: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  } catch {}
}

import { create } from "zustand";

type SidebarStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Restore open state from localStorage (call once after mount). */
  hydrate: () => void;
};

export const useSidebarStore = create<SidebarStore>((set) => ({
  open: false,
  setOpen: (open) => {
    setStored(open);
    set({ open });
  },
  toggle: () => {
    set((s) => {
      const next = !s.open;
      setStored(next);
      return { open: next };
    });
  },
  hydrate: () => set({ open: getStored() }),
}));
