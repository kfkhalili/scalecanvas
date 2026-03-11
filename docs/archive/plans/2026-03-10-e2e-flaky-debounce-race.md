# E2E Flaky Tests — Root Cause Analysis

**Date:** 2026-03-10
**Status:** ✅ **COMPLETE** — All findings resolved.
**Passing commit:** `419fd42` — fix: E2E resilience improvements
**Failing commit:** `8944bd8` — fix(handoff): resolve remaining M2/M3/M4 and H5 findings

---

## Executive Summary

All 11 Playwright e2e tests pass on `419fd42`. They become flaky/failing on `8944bd8` due to a **race condition** introduced by a 500 ms debounce on the anonymous workspace persistence path in `InterviewSplitView.tsx`. When Playwright's `page.reload()` executes within 500 ms of the last canvas/store change, React's `useEffect` cleanup fires (`clearTimeout(persistTimer)`) before the timer callback runs, so the canvas state is **never written to `sessionStorage`**. After reload, `loadAnonymousWorkspace()` finds an empty store → tests expecting persisted nodes fail.

---

## Findings

| # | Severity | File | Finding |
|---|----------|------|---------|
| 1 | 🔴 High ✅ | `components/interview/InterviewSplitView.tsx` | 500 ms debounce persist timer is **cancelled on unmount** instead of flushed — data lost on reload |
| 2 | 🟡 Low ✅ | same file | Real-world UX bug: user who edits canvas then navigates away within 500 ms also loses changes |
| 3 | ℹ️ Info | `app/api/auth/handoff/route.ts` | `Retry-After` header added to 429 — correct, no test impact |
| 4 | ℹ️ Info | `components/PostAuthRoot.tsx` | `notifyTrialAlreadyClaimed` toast callback added — no test impact |
| 5 | ℹ️ Info | `lib/sessionBootstrap.ts` | Optional `notifyTrialAlreadyClaimed` dep injected — no test impact |

---

## Detailed Analysis

### Finding 1 — The race condition (🔴 High)

**Before (`419fd42`):**
```typescript
const unsubCanvas = useCanvasStore.subscribe(() => persistAnonymousWorkspace());
const unsubHandoff = useAuthHandoffStore.subscribe(() => persistAnonymousWorkspace());
return () => {
  unsubCanvas();
  unsubHandoff();
};
```
Every store change triggers an **immediate synchronous** persist. At the time `page.reload()` fires, the data is already in `sessionStorage`.

**After (`8944bd8`):**
```typescript
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const schedulePersist = (): void => {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistAnonymousWorkspace, 500);
};
const unsubCanvas = useCanvasStore.subscribe(schedulePersist);
const unsubHandoff = useAuthHandoffStore.subscribe(schedulePersist);
return () => {
  unsubCanvas();
  unsubHandoff();
  if (persistTimer !== null) clearTimeout(persistTimer); // ← KILLS PENDING PERSIST
};
```

**Failure sequence in tests:**
1. Test drags "Lambda" node → canvas store updates → `schedulePersist()` sets a 500 ms timer.  
2. `expect(nodeByLabel(...)).toBeVisible()` resolves in ~100–200 ms (node visible but timer not yet fired).  
3. `page.reload()` → browser begins page unload → React runs `useEffect` cleanup → `clearTimeout(persistTimer)` kills the timer.  
4. Timer callback (`persistAnonymousWorkspace`) **never runs**.  
5. Page reloads → `loadAnonymousWorkspace()` reads empty `sessionStorage` → no nodes → assertion fails.

This affects every test in `anonymous-canvas.spec.ts` and any cross-auth test that depends on canvas state surviving a reload.

---

## Prioritised Action List

1. ✅ **🔴 Flush on unmount instead of cancelling** — **RESOLVED** — change the `useEffect` cleanup in `InterviewSplitView.tsx` to call `persistAnonymousWorkspace()` synchronously when a pending timer exists, *then* clear it. This preserves the debounce benefit for rapid successive changes during normal use while guaranteeing persistence before unmount.

   ```typescript
   return () => {
     unsubCanvas();
     unsubHandoff();
     if (persistTimer !== null) {
       clearTimeout(persistTimer);
       persistAnonymousWorkspace(); // flush any in-flight debounce
     }
   };
   ```

2. No other action required — the remaining changes in `8944bd8` are unrelated to the test failures.

---

## Fix Applied

`components/interview/InterviewSplitView.tsx` updated to extract a `flushPersist` helper that:
- Registers a `window.addEventListener("beforeunload", flushPersist)` so a hard browser reload flushes the in-flight timer synchronously before the page dies.
- Also calls `flushPersist()` in the React cleanup (`useEffect` return) to handle SPA navigations / component unmounts.

All 11 e2e tests confirmed passing on `8944bd8` after the fix.
