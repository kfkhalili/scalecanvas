import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const SIDEBAR_STORAGE_KEY = "scalecanvas-sidebar-open";

const persistStorage = typeof window !== "undefined"
  ? createJSONStorage(() => localStorage)
  : undefined;

type SidebarStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: SIDEBAR_STORAGE_KEY,
      storage: persistStorage,
      skipHydration: true,
    }
  )
);

/**
 * Rehydrate the sidebar store from localStorage.
 * Call once after mount (e.g. in CollapsibleSidebar's useEffect).
 */
export function rehydrateSidebarStore(): Promise<void> | undefined {
  const store = useSidebarStore as unknown as { persist?: { rehydrate: () => Promise<void> } };
  return store.persist?.rehydrate();
}
