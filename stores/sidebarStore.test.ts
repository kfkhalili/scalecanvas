import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSidebarStore } from "./sidebarStore";

const STORAGE_KEY = "scalecanvas-sidebar-open";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  useSidebarStore.setState({ open: false });
});

describe("sidebarStore", () => {
  it("starts closed", () => {
    expect(useSidebarStore.getState().open).toBe(false);
  });

  it("toggle flips open state and persists", () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().open).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");

    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().open).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "false");
  });

  it("setOpen sets value and persists", () => {
    useSidebarStore.getState().setOpen(true);
    expect(useSidebarStore.getState().open).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
  });

  it("hydrate restores from localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("true");
    useSidebarStore.getState().hydrate();
    expect(useSidebarStore.getState().open).toBe(true);
  });

  it("hydrate defaults to false when storage is empty", () => {
    useSidebarStore.getState().hydrate();
    expect(useSidebarStore.getState().open).toBe(false);
  });
});
