# Persist Canvas on Auth Handoff — Design

**Date:** 2026-02-19  
**Status:** Approved (Section 1 + Section 2 locked)

---

## Problem

After the RPC `deduct_token_and_create_session()` returns a `session_id`, the frontend triggers the BFF chat handoff (filter messages, reload) but **never persists the canvas** to the database. The `canvas_states` table remains empty for that session. If the user refreshes during the chat, the session exists but the diagram is lost.

## Fix (high level)

Immediately after the RPC returns `ok(session_id)` and the handoff runs, the frontend must call the existing **PUT /api/sessions/[sessionId]/canvas** with the current Zustand nodes/edges — **before or alongside** the chat `reload()`. Save is fire-and-forget; on PUT failure, show a non-blocking toast so the user knows the canvas might not persist.

---

## Approach: Extract helper + Sonner (Approach 2 + Option A)

- **Orchestration** lives in **`lib/`** (pure TS, dependency-injected). UI components only render and dispatch.
- **Toast** is implemented with **Sonner**; the helper receives an `onCanvasSaveError` callback; the caller (ChatPanel) passes a function that calls `toast.error(...)`. ChatPanel holds no error state.
- **Ordering:** Start the canvas save request first, then run `setMessages(filtered)` and `reload()` so the browser can open the save connection while the streaming connection to Bedrock starts — preserving fast Time To First Token (TTFT).

---

## Section 1: Behavior and Data Flow (Approved)

- **Trigger:** Unchanged. When `pendingSessionId` is set (after RPC returns `session_id`), the handoff runs.
- **New step:** Before `setMessages(filtered)` and `reload()`, call the existing canvas save (PUT) with the current Zustand state. Do not await; fire-and-forget.
- **Error handling:** If the save returns an error, invoke `onCanvasSaveError()`. The caller uses this to show a non-blocking toast (e.g. Sonner). No blocking modals; chat reload still runs.
- **Ordering:** Start `saveCanvasApi(sessionId, canvasState)` first, then `setMessages(filtered)` and `reload()`.

---

## Section 2: Helper + Toast Wiring (Approved)

### 2.1 Helper in `lib/`

- New module: **`lib/authHandoff.ts`** (or **`lib/bffHandoff.ts`**).
- One exported function: **`runBffHandoff`** (or equivalent name). It is **plain TypeScript**: no React, no DOM, no direct network. It receives:
  - `sessionId: string`
  - `messages` (current chat messages)
  - `getCanvasState: () => CanvasState`
  - `saveCanvasApi: (sessionId: string, state: CanvasState) => Promise<Result<...>>`
  - `setMessages: (fn) => void`
  - `reload: () => void`
  - `onCanvasSaveError: () => void`
- **Sequence:**  
  1. Start `saveCanvasApi(sessionId, getCanvasState())` (do not await).  
  2. In its `.then()` / result handling: on `err`, call `onCanvasSaveError()`.  
  3. Filter out the teaser message from `messages`.  
  4. Call `setMessages(filtered)`.  
  5. Call `reload()`.

Pure dependency injection: the helper only orchestrates the functions it is given.

### 2.2 Where the toast is shown

- The **caller** of the helper shows the toast. That caller is **ChatPanel** (or a thin wrapper). When the helper invokes `onCanvasSaveError`, the callback runs and shows the toast; ChatPanel does not store any error state.

### 2.3 Option A: Sonner

- Add **Sonner** as a dependency.
- In the app layout (or a provider), render **`<Toaster />`**.
- In ChatPanel, pass **`onCanvasSaveError: () => toast.error("Your diagram couldn't be saved. You can keep working; try refreshing later to see if it's there.")`** (or similar copy).
- ChatPanel remains thin: no `canvasSaveError` state, no inline notice component.

### 2.4 Wiring in ChatPanel

- The existing effect that runs when `pendingSessionId` is set **stops** inlining filter + setMessages + reload.
- It instead calls **`runBffHandoff(...)`** from `lib/` with the above arguments (including the Sonner-based `onCanvasSaveError`).
- ChatPanel does not contain logic for “when to save” or “what to do on save error”; it only dispatches to the helper and supplies the callback.

---

## Testing

- **Unit test the `lib/` helper** (e.g. `lib/authHandoff.test.ts` or `lib/bffHandoff.test.ts`):
  - Given mocks for `saveCanvasApi`, `setMessages`, `reload`, `onCanvasSaveError`:
    - Verify the **order**: save is triggered first, then setMessages with filtered messages (teaser removed), then reload.
    - Verify that when `saveCanvasApi` resolves to `err`, `onCanvasSaveError` is called exactly once.
    - Verify that when `saveCanvasApi` resolves to `ok`, `onCanvasSaveError` is not called.
- No need to mount ChatPanel or mock the Vercel AI SDK for this sequence.

---

## Implementation Plan

1. **TDD — RED:** Add `lib/authHandoff.test.ts` (or `lib/bffHandoff.test.ts`) with tests for:
   - Save invoked first with correct `sessionId` and state; then setMessages with teaser filtered; then reload.
   - On save `err`, `onCanvasSaveError` called once.
   - On save `ok`, `onCanvasSaveError` not called.
2. **TDD — GREEN:** Implement `lib/authHandoff.ts` (or `lib/bffHandoff.ts`) with `runBffHandoff` satisfying the tests. Use `isTeaserMessage` from `lib/plg` for filtering.
3. **Sonner:** Add `sonner` dependency; add `<Toaster />` to the root layout (or appropriate provider).
4. **ChatPanel:** Replace the inline handoff logic in the effect with a single call to `runBffHandoff(..., onCanvasSaveError: () => toast.error(...))`. Remove the local filter/setMessages/reload and the handoff-done ref logic from the effect; the helper encapsulates it.
5. **Verification:** Run full test suite; run lint; manually verify: anonymous eval → sign in → canvas persists (check DB or refresh and see diagram still there); simulate save failure and confirm toast appears and chat still streams.

---

## Summary

| Item | Choice |
|------|--------|
| Where orchestration lives | `lib/` (pure TS, dependency-injected) |
| Toast | Sonner; callback-based from helper |
| Ordering | Save (fire-and-forget) → setMessages(filtered) → reload |
| ChatPanel | Only dispatches to helper; no error state |
| Testing | Unit test helper for order + onCanvasSaveError behavior |
