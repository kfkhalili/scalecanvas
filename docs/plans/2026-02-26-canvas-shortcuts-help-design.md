# Canvas shortcuts help (“?”) — Design

## Summary

Add a “?” (help) button on the canvas overlay that opens a panel listing diagram keyboard shortcuts and interactions. Users discover multi-select (Shift + drag) and other canvas actions without changing pan/zoom behavior.

---

## 1. Placement and trigger

- **Location:** Canvas overlay, bottom-right, in the same control strip as the Evaluate button. Layout: `[ ? ] [ Evaluate ]` (help left of Evaluate).
- **Trigger:** Button with HelpCircle icon (Lucide), `aria-label="Canvas shortcuts"`. Click toggles the panel open/closed.
- **Scope:** Canvas-only hints (diagram interaction). No change to sidebar “Settings & help.”

---

## 2. Panel content

- **Title:** “Diagram shortcuts”
- **Entries (shortcut | description):**
  - **Shift + drag** — Select multiple (box select)
  - **Drag** — Pan
  - **Scroll** — Zoom
  - **Escape** — Clear selection

Only document current ReactFlow default behavior. Add rows later if we add shortcuts (e.g. Delete).

---

## 3. Panel behavior

- **Toggle:** Click “?” opens panel; click again or outside or Escape closes it.
- **Position:** Fixed, anchored near the “?” button (e.g. above or left so it doesn’t cover Evaluate). Same styling as existing overlays: `rounded-xl border bg-popover shadow`, z-index above canvas.
- **Dismiss:** Outside click, Escape key, or click “?” again. No focus trap; keep lightweight.

---

## 4. Implementation context

- **Component location:** FlowCanvas (same wrapper that renders the Evaluate overlay). One boolean state for panel open/closed.
- **Pattern:** Reuse app pattern: fixed div + `createPortal` to document.body for outside-click dismiss (see CollapsibleSidebar settings menu). Panel content: title + list of shortcut rows (e.g. `<kbd>` for keys).
