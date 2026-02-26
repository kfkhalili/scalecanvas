/**
 * Diagram shortcuts panel: data and position logic.
 * Used by FlowCanvas "?" help panel; tested here.
 */

export type DiagramShortcutEntry = {
  keys: readonly string[];
  description: string;
};

const DIAGRAM_SHORTCUT_ENTRIES: readonly DiagramShortcutEntry[] = [
  { keys: ["Shift", "drag"], description: "Select multiple (box select)" },
  { keys: ["Drag"], description: "Pan" },
  { keys: ["Scroll"], description: "Zoom" },
  { keys: ["Escape"], description: "Clear selection" },
];

export function getDiagramShortcutEntries(): readonly DiagramShortcutEntry[] {
  return DIAGRAM_SHORTCUT_ENTRIES;
}

export type ShortcutsPanelPosition = {
  bottom: number;
  left: number;
};

export function computeShortcutsPanelPosition(
  rect: DOMRect | { top: number; left: number; width?: number; height?: number },
  windowHeight: number
): ShortcutsPanelPosition {
  return {
    bottom: windowHeight - rect.top + 8,
    left: rect.left,
  };
}
