# Race Condition & Durability Code Smells Audit

**Date:** 2026-03-10
**Prior report:** [2026-03-10-e2e-flaky-debounce-race.md](2026-03-10-e2e-flaky-debounce-race.md) (findings #1 and #2 resolved)

---

## Executive Summary

Systematic audit of the codebase for patterns that produce race conditions, flaky tests, and implicit durability assumptions. Found **14 findings** across 5 categories. The core architectural issue is that **no persistence operation surfaces observable "saving / saved / failed" state**, forcing both the UI and tests to rely on timing heuristics.

---

## Findings Table

| # | Severity | Category | File | Line(s) | Finding |
|---|----------|----------|------|---------|---------|
| S1 | 🔴 High | Durability | `components/canvas/FlowCanvas.tsx` | 220–232 | Canvas save debounce (800 ms) clears timer on unmount without flushing; no `beforeunload` handler |
| S2 | 🔴 High | Durability | `components/canvas/FlowCanvas.tsx` | 224–225 | `saveCanvasApi` result is discarded (`.then(() => {})`) — save errors are silently swallowed |
| S3 | 🟠 Medium | Observable state | `stores/canvasStore.ts` | — | No `isSaving`, `isDirty`, `lastSavedAt`, or `saveError` state in canvas store |
| S4 | 🟠 Medium | Observable state | `stores/anonymousWorkspaceStorage.ts` | 139–170 | `persistAnonymousWorkspace()` returns `void` — callers cannot observe success/failure |
| S5 | 🟠 Medium | Observable state | `hooks/useAuthHandoff.ts` | 52 | `runBffHandoff` shows a loading toast but no store state tracks handoff progress |
| S6 | 🟡 Low | Implicit ordering | `components/interview/InterviewSplitView.tsx` | 70, 96, 131, 143, 164, 201, 209 | 7 uses of `queueMicrotask` for state sequencing — fragile if any dependency becomes async |
| S7 | 🟡 Low | Implicit ordering | `components/PostAuthRoot.tsx` | 39 | `queueMicrotask(() => setStoresReady(true))` assumes `loadAnonymousWorkspace()` is synchronous |
| S8 | 🟠 Medium | Test timing | `e2e/handoff-resilience.spec.ts` | 46 | `page.waitForTimeout(2_000)` — magic sleep to wait for "stray duplicate calls" |
| S9 | 🟠 Medium | Test timing | `e2e/cross-auth-journeys.spec.ts` | 225, 232 | Two `page.waitForTimeout(500)` magic sleeps — flaky if CI is slower |
| S10 | 🟠 Medium | Test timing | `e2e/cross-auth-journeys.spec.ts` | 117–121 | `handoffResPromise` has no `res.status() < 400` filter — accepts failed handoff calls |
| S11 | 🟡 Low | Test timing | `e2e/anonymous-canvas.spec.ts` | 51, 77, 90, 111, 167 | 5 `page.reload()` calls without `waitForLoadState('load')` — works because anonymous persist is now sync-flushed on beforeunload, but pattern is fragile |
| S12 | 🟡 Low | Test timing | `e2e/cross-auth-journeys.spec.ts` | 228 | `page.reload()` without preceding assertion that the save has committed |
| S13 | 🟠 Medium | Durability | `components/canvas/FlowCanvas.tsx` | 330 | `setInterval` for countdown timer — harmless for data, but leaking timer on HMR re-renders is possible |
| S14 | 🟡 Low | Implicit ordering | `components/interview/InterviewSplitView.tsx` | 180 | `setTimeout(() => setHandoffTranscript(Option.none()), 0)` — kicks state update to next task to avoid React warning, but ordering is non-obvious |

---

## Detailed Analysis by Category

### Category 1: Fire-and-Forget Persistence (S1, S2, S4)

#### S1 — FlowCanvas canvas save debounce loses data on unmount (🔴 High)

**File:** `components/canvas/FlowCanvas.tsx` lines 216–232

```typescript
saveTimeoutRef.current = setTimeout(() => {
  saveTimeoutRef.current = null;
  const state = getCanvasState();
  void Effect.runPromise(
    Effect.either(saveCanvasApi(sessionId, state))
  ).then(() => {});
}, SAVE_DEBOUNCE_MS);
// ...
return () => {
  if (saveTimeoutRef.current !== null) {
    clearTimeout(saveTimeoutRef.current);  // ← data dropped
  }
};
```

This is the **exact same bug** we just fixed in `InterviewSplitView.tsx` for anonymous workspace persistence, but for authenticated session canvas saves. If a user edits the canvas and navigates away (or the session switches) within 800 ms, the pending save is discarded. Unlike the anonymous case, this save goes to the **database** — data loss is permanent.

**Fix:** Extract a `flushPersist` helper as we did for InterviewSplitView. Add a `beforeunload` listener. Consider also flushing on `visibilitychange` (tab backgrounded on mobile).

#### S2 — Save errors silently swallowed (🔴 High)

**File:** `components/canvas/FlowCanvas.tsx` line 224

```typescript
void Effect.runPromise(
  Effect.either(saveCanvasApi(sessionId, state))
).then(() => {});
```

The `Either` result is discarded. If the PUT fails (network error, 500, auth expired), the user is never notified and the store has no `saveError` state for the UI to react to. The user believes their work is saved.

**Fix:** Inspect the `Either.left` case. Set a `saveError` or `lastSaveStatus` in the canvas store. Show a non-intrusive error indicator (e.g. a red dot on the canvas toolbar).

#### S4 — `persistAnonymousWorkspace()` is void (🟠 Medium)

**File:** `stores/anonymousWorkspaceStorage.ts` line 139

The function catches `localStorage` quota errors and shows a toast, but returns `void`. The caller (`InterviewSplitView`) cannot distinguish "wrote successfully" from "silently failed", making it impossible to track dirty state.

**Fix:** Return `boolean` or `Either<void, StorageError>`.

---

### Category 2: Missing Observable State (S3, S5)

#### S3 — Canvas store has no save lifecycle state (🟠 Medium)

**File:** `stores/canvasStore.ts`

The store holds `nodes`, `edges`, `viewport`, and `hasAttemptedEval` — purely presentation state. There is no:
- `isDirty: boolean` — has the canvas changed since last successful save?
- `isSaving: boolean` — is a save in flight?
- `lastSavedAt: Date | null` — when was the last successful persist?
- `saveError: string | null` — did the last save fail?

Without these, neither the UI nor tests can deterministically know when it's safe to reload, navigate, or assert.

**Fix:** Add save lifecycle fields to `canvasStore`. Have `FlowCanvas` update them when save starts/completes/fails. This also enables a "saving…" / "saved" indicator in the UI (a standard UX pattern users expect).

#### S5 — Handoff progress not tracked in store (🟠 Medium)

**File:** `hooks/useAuthHandoff.ts` line 52

`runBffHandoff` is `void`-fired with a loading toast as the only feedback. The `handoffDoneRef` flag prevents duplicates but doesn't tell the store whether handoff is in-progress, succeeded, or failed. Other components cannot react to handoff status.

**Fix:** Add `handoffStatus: 'idle' | 'in-progress' | 'done' | 'error'` to `authHandoffStore`.

---

### Category 3: Test Timing Smells (S8, S9, S10, S11, S12)

#### S8 — Magic sleep for dedup check (🟠 Medium)

**File:** `e2e/handoff-resilience.spec.ts` line 46

```typescript
await page.waitForTimeout(2_000);
```

Waits 2 seconds "for stray duplicate calls to arrive." If the system had an observable `handoffStatus === 'done'` in the DOM, the test could wait for that instead.

**Fix:** Once S5 is implemented, wait for `[data-handoff-status="done"]` in the DOM, then assert call count.

#### S9 — Two magic sleeps in cross-auth test (🟠 Medium)

**File:** `e2e/cross-auth-journeys.spec.ts` lines 225, 232

```typescript
await page.waitForTimeout(500);
```

Waits 500 ms after a drag-to-canvas to assert that the node count hasn't changed (proving read-only mode). If the canvas had an `isReadOnly` attribute in the DOM, the test could assert on that instead.

**Fix:** Add `data-read-only="true"` to the canvas container when `isSessionActive === false`. Wait for that attribute, then assert.

#### S10 — Missing status filter on handoff response (🟠 Medium)

**File:** `e2e/cross-auth-journeys.spec.ts` lines 117–121

```typescript
const handoffResPromise = page.waitForResponse(
  (res) =>
    res.url().includes("/api/auth/handoff") && res.request().method() === "POST",
  { timeout: 20_000 }
);
```

Same pattern as the bug we fixed in `canvasSavedPromise`. A 429 or 500 response would satisfy this promise.

**Fix:** Add `&& res.status() < 400`.

#### S11, S12 — `page.reload()` without load state assertion (🟡 Low)

5 instances in `anonymous-canvas.spec.ts` and 1 in `cross-auth-journeys.spec.ts`. These currently work because the anonymous path now flushes on `beforeunload` and the data is in `localStorage` (synchronous read after load). But the pattern is fragile — if persistence ever becomes async (e.g. IndexedDB), these will break.

**Fix:** Add `await page.waitForLoadState('load')` after every `page.reload()` as a defensive baseline.

---

### Category 4: Implicit Ordering via queueMicrotask (S6, S7, S14)

#### S6 — 7 microtask delays in InterviewSplitView (🟡 Low)

**File:** `components/interview/InterviewSplitView.tsx` (7 locations)

Each `queueMicrotask` delays a state setter by one microtask to avoid React batching issues or setState-during-render warnings. The ordering is correct *today* because the operations they depend on are synchronous, but:
- They're not self-documenting (no comments explaining *why* the delay is needed)
- If a dependency becomes async, the microtask will fire before the async work completes

**Fix:** Add a comment block to each explaining the invariant it relies on. For the `loadAnonymousWorkspace` case (S7), consider making `loadAnonymousWorkspace` return a `Promise<void>` that resolves when done, and awaiting it explicitly.

---

### Category 5: The Root Pattern — No "Saved" Signal

All categories above stem from one architectural gap: **persistence operations are fire-and-forget with no observable lifecycle.**

The current flow:
```
store change → debounce timer → save API call → result discarded
```

The ideal flow:
```
store change → mark dirty → debounce timer → mark saving → save API call
  → success: mark clean, update lastSavedAt
  → failure: mark error, show indicator, enable retry
```

This enables:
- **UI:** "Saving…" / "Saved" / "Save failed" indicators
- **Tests:** `await page.waitForSelector('[data-save-status="saved"]')` — no magic sleeps
- **beforeunload:** `if (isDirty) event.preventDefault()` — browser-native "unsaved changes" dialog

---

## Prioritised Action List

| Priority | Action | Fixes | Effort |
|----------|--------|-------|--------|
| 1 | Add save lifecycle state to `canvasStore` (`isDirty`, `isSaving`, `lastSavedAt`, `saveError`) | S2, S3 | Small |
| 2 | Flush `FlowCanvas` debounce on unmount + `beforeunload` (same pattern as InterviewSplitView fix) | S1 | Small |
| 3 | Consume save lifecycle in `FlowCanvas`: update store on save start/success/error | S2, S3 | Small |
| 4 | Add `data-save-status` attribute to canvas container for e2e testability | S8, S9, S11, S12 | Small |
| 5 | Add `res.status() < 400` to remaining `waitForResponse` calls in e2e tests | S10 | Trivial |
| 6 | Replace `waitForTimeout` magic sleeps with observable DOM state assertions | S8, S9 | Small |
| 7 | Add `data-read-only` attribute to canvas when concluded | S9 | Trivial |
| 8 | Make `persistAnonymousWorkspace` return `boolean` | S4 | Trivial |
| 9 | Add `handoffStatus` to `authHandoffStore` | S5 | Small |
| 10 | Document `queueMicrotask` invariants with inline comments | S6, S7, S14 | Trivial |
