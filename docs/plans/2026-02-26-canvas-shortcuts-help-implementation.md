# Canvas shortcuts help (“?”) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a “?” button on the canvas that opens a panel listing diagram shortcuts (Shift+drag = box select, Drag = pan, Scroll = zoom, Escape = clear selection) so users can discover multi-select.

**Architecture:** FlowCanvas already renders an overlay (Evaluate button) in a wrapper div. Add a second button (“?”) and a portal-rendered panel (same pattern as CollapsibleSidebar settings menu). One boolean state for panel open; close on outside click, Escape, or toggle. Panel lists four shortcut rows; no new keyboard behavior.

**Tech Stack:** React, createPortal (react-dom), Lucide HelpCircle, existing Tailwind/bg-popover patterns.

---

## Task 1: FlowCanvas — shortcuts panel state, refs, and “?” button

**Files:**
- Modify: `components/canvas/FlowCanvas.tsx`

**Step 1: Add imports**

Add `createPortal` from `react-dom`, `HelpCircle` from `lucide-react`, and `useState` to the React import if not already present.

**Step 2: Add state and refs in FlowCanvas (exported component)**

In the component that returns the wrapper div (the one that currently has `evaluateActionOpt` and the Evaluate button):

- Add `const [shortcutsOpen, setShortcutsOpen] = useState(false)`.
- Add `const helpBtnRef = useRef<HTMLButtonElement>(null)`.
- Add `const helpPanelRef = useRef<HTMLDivElement>(null)`.

**Step 3: Add the “?” button to the overlay**

In the same overlay area as the Evaluate button, add a container that holds both buttons (e.g. `flex gap-2 items-center`). Place the help button to the left of the Evaluate button:

- Button: `type="button"`, `ref={helpBtnRef}`, `onClick={() => setShortcutsOpen((prev) => !prev)}`, `aria-label="Canvas shortcuts"`.
- Icon: `<HelpCircle className="h-4 w-4" />` (or similar size to match Evaluate).
- Reuse the same visual style as the Evaluate button (rounded-md border border-input bg-background, etc.) so both look like one control strip.

**Step 4: Verify in browser**

Run dev server, open a session with canvas. Confirm the “?” button appears bottom-right, left of Evaluate, and toggles no panel yet (panel in next task).

**Step 5: Commit**

```bash
git add components/canvas/FlowCanvas.tsx
git commit -m "feat(canvas): add shortcuts help button to canvas overlay"
```

---

## Task 2: FlowCanvas — outside-click and Escape to close panel

**Files:**
- Modify: `components/canvas/FlowCanvas.tsx`

**Step 1: Outside-click close**

Add a `useEffect` that runs when `shortcutsOpen` is true: attach a `click` listener (capture phase) to `document`. In the handler, if the click target is not inside `helpBtnRef.current` and not inside `helpPanelRef.current`, call `setShortcutsOpen(false)`. Cleanup: remove the listener. Pattern: same as `CollapsibleSidebar.tsx` (settings menu), lines 70–78.

**Step 2: Escape key close**

Add a `useEffect` that runs when `shortcutsOpen` is true: attach a `keydown` listener to `document`. If `e.key === "Escape"`, call `setShortcutsOpen(false)`. Cleanup: remove the listener.

**Step 3: Verify**

Open “?” panel, click outside → panel closes. Open again, press Escape → panel closes.

**Step 4: Commit**

```bash
git add components/canvas/FlowCanvas.tsx
git commit -m "feat(canvas): close shortcuts panel on outside click and Escape"
```

---

## Task 3: FlowCanvas — render shortcuts panel via portal

**Files:**
- Modify: `components/canvas/FlowCanvas.tsx`

**Step 1: Compute panel position when opening**

When rendering the panel, get the “?” button position: `helpBtnRef.current?.getBoundingClientRect()`. If `shortcutsOpen` and rect is available, compute position so the panel appears above the button (e.g. `bottom: window.innerHeight - rect.top + 8`, `left: rect.left`, so the panel’s bottom edge is just above the button). Store in state or derive during render (e.g. a small state like `panelPosition: Option<{ bottom: number; left: number }>` set when opening, to avoid layout thrash).

**Step 2: Render panel with createPortal**

When `shortcutsOpen` is true and position is available, call `createPortal(panelElement, document.body)`. Panel element:

- A single wrapper `div` with `ref={helpPanelRef}`, `className` including `fixed z-[200] ... rounded-xl border bg-popover shadow-xl`, and `style={{ bottom, left }}` (use the same z-index as CollapsibleSidebar menus so it sits above canvas and Evaluate).
- Inside: a title “Diagram shortcuts” (e.g. `text-sm font-medium text-foreground`).
- Then a list of four rows. Each row: shortcut keys + description. Use `<kbd>` for keys (e.g. “Shift + drag”, “Drag”, “Scroll”, “Escape”) and a short label (e.g. “Select multiple (box select)”, “Pan”, “Zoom”, “Clear selection”). Structure: consistent spacing (e.g. `space-y-2`), small text so the panel stays compact.

**Step 3: Accessibility**

Ensure the panel has a role and label (e.g. `role="dialog"` and `aria-label="Diagram shortcuts"`). The “?” button already has `aria-label="Canvas shortcuts"`.

**Step 4: Verify in browser**

Open “?” → panel appears above the button with four shortcuts. Close via outside click or Escape. No focus trap required.

**Step 5: Commit**

```bash
git add components/canvas/FlowCanvas.tsx
git commit -m "feat(canvas): render diagram shortcuts panel with portal"
```

---

## Task 4: Lint and type-check

**Files:**
- (no new files)

**Step 1: Run lint**

Run: `npm run lint`  
Expected: no errors.

**Step 2: Run type-check**

Run: `npx tsc --noEmit`  
Expected: no errors.

**Step 3: Fix any issues from Tasks 1–3**

If lint or tsc reported issues in `FlowCanvas.tsx`, fix them (e.g. unused refs, missing deps in useEffect, strict null checks).

**Step 4: Commit if fixes were needed**

```bash
git add components/canvas/FlowCanvas.tsx
git commit -m "fix(canvas): lint and types for shortcuts panel"
```

---

## Reference

- Design: `docs/plans/2026-02-26-canvas-shortcuts-help-design.md`
- Outside-click / portal pattern: `components/layout/CollapsibleSidebar.tsx` (settingsOpen, settingsBtnRef, settingsMenuRef, createPortal, document.body).
- Overlay layout: `components/canvas/FlowCanvas.tsx` (Evaluate button in `absolute bottom-2 right-2 z-10`).
