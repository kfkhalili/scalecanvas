# E2E Test Stability Audit

## Executive Summary

The e2e test suite (6 files, 10 specs) covers anonymous canvas persistence, JWT-bypass authentication, auth handoff journeys, conclusion/read-only flows, and retry resilience. While functionally comprehensive, the suite has **structural reliability issues** that cause flaky failures in CI. This report identifies root causes, not symptoms, and proposes structural fixes rather than timeout-based workarounds.

The failing test (`cross-auth-journeys.spec.ts:161`) exposed a **stale closure race condition** in the app's read-only guard — the `onDrop` handler in `FlowCanvas` captures `isSessionActive` via `useCallback`, but between the synchronous zustand store update and React's next render commit, the old closure still permits drops. This is an **application bug**, not a test bug, and the fix belongs in the app code.

---

## Findings

### ✅ F-1: Stale `onDrop` Closure Allows Drops After Deactivation (Application Bug)

**Status:** RESOLVED — `onDrop` reads store directly; `addNode` guard added; `NodeLibrary` drag disabled when inactive.

**Severity:** 🔴 High — root cause of the reported flake

**Location:** [FlowCanvas.tsx](../../../components/canvas/FlowCanvas.tsx#L95-L108)

**Mechanism:**

1. User clicks "End interview" → `requestEndInterview()` calls `deactivate()` synchronously
2. Zustand store updates `phase` to `"inactive"` — `canInteract()` returns `false`
3. React schedules re-render that re-creates the `onDrop` closure with `isSessionActive = false`
4. **Before that re-render commits**, the old `onDrop` closure still has `isSessionActive = true`
5. If a drag-and-drop completes in this window, `addNodeAction()` executes and the node is added

**Why it's flaky:** The window between store update and React re-render is typically < 1 frame (16ms), but under CI load (slow runner, workers=1, cold start) it can be longer. Playwright's `dragTo()` is fast enough to slip through.

**Root cause code:**

```typescript
// FlowCanvas.tsx — guard is only in the useCallback closure
const onDrop = useCallback(
  (e: DragEvent) => {
    e.preventDefault();
    if (!isSessionActive) return;        // ← captured at last render
    // ... adds node
  },
  [reactFlowInstance, addNodeAction, isSessionActive]  // ← only re-created on re-render
);
```

**Structural fix — read from the store directly in `onDrop`:**

Replace the closure-captured `isSessionActive` with a direct store read at drop time:

```typescript
const onDrop = useCallback(
  (e: DragEvent) => {
    e.preventDefault();
    if (!canInteract(useWorkspaceStore.getState().phase)) return;
    // ...
  },
  [reactFlowInstance, addNodeAction]
);
```

This eliminates the stale closure entirely. The store is always current; no dependency on React's render cycle.

A second defense layer should be added at the `addNode` store action level:

```typescript
// canvasStore.ts
addNode: (node) => {
  if (!canInteract(useWorkspaceStore.getState().phase)) return;
  set({ nodes: [...get().nodes, node] });
},
```

**Also disable drag initiation in `NodeLibrary`:**

```typescript
// NodeLibrary.tsx — ServiceItem
const isSessionActive = useWorkspaceStore((s) => canInteract(s.phase));
<div
  draggable={isSessionActive}
  // ...
>
```

This provides three layers of defense: source (drag disabled), target (direct store read in onDrop), and store (addNode guard). Only the first two are needed; the third is defense-in-depth.

---

### ✅ F-2: `route.fulfill()` Violates PNA Against Localhost

**Status:** RESOLVED — replaced with `route.abort("failed")`.

**Severity:** 🔴 High — can cause phantom timeouts in CI

**Location:** [handoff-resilience.spec.ts](../../../e2e/handoff-resilience.spec.ts#L81-L89)

The canvas save retry test uses `route.fulfill({ status: 500 })` to simulate a transient server error. Per the project's own [README](../../../e2e/README.md), this changes Chromium's address-space classification from "local" to "public", triggering Private Network Access (PNA) preflight checks on subsequent requests to `127.0.0.1`. The retry request may silently fail due to a CORS preflight, not a transient error.

The transcript retry test correctly uses `route.abort("failed")` — the canvas test should do the same.

**Fix:**

```typescript
// handoff-resilience.spec.ts — canvas retry test
if (canvasPutCount === 1) {
  void route.abort("failed");   // was: route.fulfill({ status: 500 })
} else {
  void route.fallback();
}
```

---

### ✅ F-3: NodeLibrary Has No Disabled State

**Status:** RESOLVED — `draggable={isSessionActive}` added to `ServiceItem`.

**Severity:** 🟠 Medium — defense-in-depth gap

**Location:** [NodeLibrary.tsx](../../../components/canvas/NodeLibrary.tsx#L85)

`ServiceItem` always renders `draggable` regardless of session state. Even when the canvas drop handler blocks the node, the user can still initiate a drag (visual confusion), and as shown in F-1, the guard has a stale capture window. The library should disable `draggable` when `isSessionActive` is `false`.

---

### ✅ F-4: `addNode` Has No Guard

**Status:** RESOLVED — `canInteract` guard added to `addNode` store action.

**Severity:** 🟠 Medium — defense-in-depth gap

**Location:** [canvasStore.ts](../../../stores/canvasStore.ts#L135)

```typescript
addNode: (node) => set({ nodes: [...get().nodes, node] }),
```

There is no check on session phase. If any code path — current or future — calls `addNode` when the session is inactive, nodes will be added silently. Adding a guard makes the invariant self-enforcing.

---

### ✅ F-5: Test Uses Direct DB Patch Instead of App Flow for Conclusion

**Status:** RESOLVED — comment added documenting the trade-off and pointing to unit test coverage.

**Severity:** 🟠 Medium — test assertion gap

**Location:** [cross-auth-journeys.spec.ts](../../../e2e/cross-auth-journeys.spec.ts#L142-L156)

After clicking "End interview", the test manually PATCHes `conclusion_summary` via PostgREST because the `requestConclusion` API streams from Bedrock (which is mocked/unavailable in e2e). This means:

- The test never verifies that the conclusion API actually persists to DB
- The test relies on the manual PATCH being correctly visible on reload
- If the conclusion API flow changes, the test won't catch regressions

This is an acceptable trade-off (Bedrock isn't available in e2e), but should be documented clearly with a comment explaining why and noting that the conclusion API persistence is covered by unit tests.

---

### ✅ F-6: `cleanupUserSessions()` Errors Are Swallowed

**Status:** RESOLVED — now throws instead of logging a warning.

**Severity:** 🟠 Medium — cross-test contamination risk

**Location:** [fixtures.ts](../../../e2e/fixtures.ts#L241-L256)

```typescript
if (!res.ok) {
  console.warn(`[e2e cleanup] Failed to delete sessions for ${userId}: ${res.status}`);
}
```

If cleanup fails, the next test inherits stale sessions. With `fullyParallel: true` and `retries: 2`, a failed cleanup could cause cascading failures across retries. The function should throw on persistent failures.

---

### ✅ F-7: `afterEach` Cleanup Selects User by Test Title String Matching

**Status:** RESOLVED — warning logged when no mapping found for a renamed test.

**Severity:** 🟡 Low — fragile coupling

**Location:** [handoff-resilience.spec.ts](../../../e2e/handoff-resilience.spec.ts#L180-L194)

```typescript
const userMap: Record<string, string> = {
  "only one handoff API call despite React Strict Mode double-fire":
    E2E_HANDOFF_DEDUP_USER_ID,
  // ...
};
const userId = userMap[testInfo.title];
```

If a test is renamed, cleanup silently stops running. Use a per-test fixture or `testInfo.testId` instead.

---

### ✅ F-8: Inconsistent Timeout Strategy

**Status:** RESOLVED — timeout constants (`TIMEOUT_NAVIGATION`, `TIMEOUT_SERVER`, `TIMEOUT_VISIBLE`, `TIMEOUT_SHORT`, `TIMEOUT_POLL`) extracted to `e2e/env.ts` and applied across all spec files.

**Severity:** 🟡 Low — maintenance burden

**Location:** All spec files

| Timeout | Usage | Justification |
|---------|-------|---------------|
| 2,000ms | Read-only poll after drag | Assumes React re-render in < 2s |
| 3,000ms | Confirm dialog visibility | Assumes UI renders in < 3s |
| 5,000ms | `data-read-only` wait, zoom persistence wait | Assumes zustand + React in < 5s |
| 10,000ms | Node visibility, data-save-status | Assumes initial render in < 10s |
| 20,000ms | Session URL redirect, handoff response | Assumes server response in < 20s |
| 30,000ms | Canvas PUT, transcript batch, conclusion | Assumes Bedrock/DB in < 30s |
| 60,000ms | Entire test timeout (zoom test) | Extended deadline |

None of these are documented. A `TIMEOUT` constant object would make them maintainable and tunable for slow CI.

---

### ✅ F-9: `installApiErrorLogger()` Doesn't Fail Tests

**Status:** RESOLVED — `installApiErrorLogger` now returns `ApiErrorEntry[]`; `assertNoUnexpected5xx(errors, expectedPatterns?)` added to `fixtures.ts` and wired into auth journey specs.

**Severity:** 🟡 Low — silent failures

**Location:** [fixtures.ts](../../../e2e/fixtures.ts#L260-L275)

Non-2xx API responses are logged but tests continue. A 500 on a non-intercepted endpoint could go unnoticed. Consider collecting errors and asserting no unexpected 5xx in `afterEach`.

---

### ✅ F-10: CI Workflow Starts Dev Server in Background Without Health-Gate

**Status:** RESOLVED — "Verify Supabase is healthy" step added to CI workflow before key extraction, checking DB URL, API URL, and Auth URL from `supabase status`.

**Severity:** ℹ️ Info

**Location:** [ci.yml](../../../.github/workflows/ci.yml#L107-L118)

The workflow starts `pnpm dev &` then polls with `curl` in a loop. If Supabase hasn't fully started, the dev server may start but fail on first request. The `reuseExistingServer: true` change (already merged) handles the Playwright port conflict, but the underlying issue is that there's no Supabase health check before the dev server starts.

---

## Severity Summary

| # | Finding | Severity | Type | Status |
|---|---------|----------|------|--------|
| F-1 | Stale `onDrop` closure allows drops after deactivation | 🔴 High | App bug | ✅ Resolved |
| F-2 | `route.fulfill()` violates PNA against localhost | 🔴 High | Test bug | ✅ Resolved |
| F-3 | NodeLibrary has no disabled state | 🟠 Medium | App gap | ✅ Resolved |
| F-4 | `addNode` store action has no guard | 🟠 Medium | App gap | ✅ Resolved |
| F-5 | Test uses direct DB patch instead of app flow | 🟠 Medium | Test design | ✅ Resolved |
| F-6 | `cleanupUserSessions()` swallows errors | 🟠 Medium | Test infra | ✅ Resolved |
| F-7 | `afterEach` cleanup uses title string matching | 🟡 Low | Test fragility | ✅ Resolved |
| F-8 | Inconsistent timeout strategy | 🟡 Low | Maintenance | ✅ Resolved |
| F-9 | API error logger doesn't fail tests | 🟡 Low | Test coverage | ✅ Resolved |
| F-10 | No Supabase health-gate in CI | ℹ️ Info | CI infra | ✅ Resolved |

---

## Prioritised Action List

1. **F-1** — Fix the stale `onDrop` closure by reading from the store directly at drop time. Add guard to `addNode` in canvasStore. Disable `draggable` in NodeLibrary when inactive. Remove the `data-read-only` wait bandaid from the test. *This is the root cause of the reported flake.*

2. **F-2** — Replace `route.fulfill({ status: 500 })` with `route.abort("failed")` in the canvas retry test to comply with the project's own PNA documentation.

3. **F-3 + F-4** — Part of F-1 fix: disable drag at source and guard `addNode` at store level.

4. **F-6** — Make `cleanupUserSessions()` throw on failure instead of logging a warning.

5. **F-7** — Replace title-based user lookup in `afterEach` with a test-scoped variable set in the test body.

6. **F-5** — Add documenting comment to the PostgREST PATCH explaining that Bedrock is unavailable in e2e and conclusion persistence is covered by unit tests.

7. **F-8** — Extract timeouts to a shared constants object in `e2e/env.ts`.

8. **F-9** — Collect 5xx errors during test and assert zero unexpected 5xx in `afterEach`.

9. **F-10** — Add `supabase status` health check in CI before starting the dev server.
