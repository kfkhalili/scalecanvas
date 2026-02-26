import { describe, it, expect } from "vitest";
import {
  getDiagramShortcutEntries,
  computeShortcutsPanelPosition,
} from "./canvasShortcuts";

describe("getDiagramShortcutEntries", () => {
  it("returns four entries for the diagram shortcuts panel", () => {
    const entries = getDiagramShortcutEntries();
    expect(entries).toHaveLength(4);
  });

  it("first entry is Shift + drag for box select", () => {
    const entries = getDiagramShortcutEntries();
    expect(entries[0]).toEqual({
      keys: ["Shift", "drag"],
      description: "Select multiple (box select)",
    });
  });

  it("second entry is Drag for pan", () => {
    const entries = getDiagramShortcutEntries();
    expect(entries[1]).toEqual({ keys: ["Drag"], description: "Pan" });
  });

  it("third entry is Scroll for zoom", () => {
    const entries = getDiagramShortcutEntries();
    expect(entries[2]).toEqual({ keys: ["Scroll"], description: "Zoom" });
  });

  it("fourth entry is Escape for clear selection", () => {
    const entries = getDiagramShortcutEntries();
    expect(entries[3]).toEqual({
      keys: ["Escape"],
      description: "Clear selection",
    });
  });
});

describe("computeShortcutsPanelPosition", () => {
  it("positions panel above the button using bottom and left", () => {
    const windowHeight = 800;
    const rect = { top: 700, left: 100, width: 40, height: 32 };
    const pos = computeShortcutsPanelPosition(rect, windowHeight);
    expect(pos).toEqual({
      bottom: windowHeight - rect.top + 8,
      left: rect.left,
    });
    expect(pos.bottom).toBe(108);
    expect(pos.left).toBe(100);
  });
});
