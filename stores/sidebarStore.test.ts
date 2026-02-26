import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "./sidebarStore";

beforeEach(() => {
  useSidebarStore.setState({ open: false });
});

describe("sidebarStore", () => {
  it("starts closed", () => {
    expect(useSidebarStore.getState().open).toBe(false);
  });

  it("toggle flips open state", () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().open).toBe(true);

    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().open).toBe(false);
  });

  it("setOpen sets value", () => {
    useSidebarStore.getState().setOpen(true);
    expect(useSidebarStore.getState().open).toBe(true);
  });

  it("setOpen(false) restores closed", () => {
    useSidebarStore.getState().setOpen(true);
    useSidebarStore.getState().setOpen(false);
    expect(useSidebarStore.getState().open).toBe(false);
  });
});
