# Race Condition Audit — 2026-03-12

## Executive Summary

Thorough audit of workspace lifecycle, persistence, canvas loading, handoff, chat activation, and anonymous storage for race conditions. **14 findings** total — **all resolved or properly guarded.** No open action items remain.

Key structural changes:

- **Change A — Snapshot Persistence:** Both API-mode and local-mode persistence write closures now use snapshots captured at `markDirty()` time instead of reading live store state at write-execution time. This eliminates the latent cross-session data corruption in Finding #1 and Finding #14, and makes the fire-and-forget flush in Finding #4 safe (the old writer's snapshot is frozen to the old session's data).

- **Change B — Session-scoped AbortController:** A module-level `AbortController` is created on `loadSession()` and aborted on session switch (`loadSession` replacing) or `reset()`. The signal is passed through `fetchCanvas` and `fetchTranscript` to the underlying `fetch()` call. In-flight content fetches are cancelled on session switch, and the `.then` callbacks check `signal.aborted` before writing state. This replaces the manual `loadingCanvasSessionIdRef` / `loadingTranscriptSessionIdRef` staleness guards (Findings #10, #11) and fully resolves Finding #3.

- **Ref-based guards:** Finding #6 (double-evaluate) now uses `isEvaluatingRef` for synchronous same-tick guard. Finding #7 (handoff after unmount) now uses `mountedRef` to skip state updates after unmount.

The second half of this report covers **structural prevention** — coding rules and patterns to stop future race conditions at the design stage.

---

## Severity Table

| # | Severity | File | Finding |
|---|----------|------|---------|
| 1 | ✅ Resolved | `lib/persistenceLifecycle.ts` | Flush reads mutable state in fire-and-forget; latent cross-session data corruption |
| 2 | ✅ Resolved | `components/chat/ChatPanel.tsx` | Activation effect revives terminated session on remount |
| 3 | ✅ Resolved | `hooks/useSessionContent.ts` | Canvas fetch completes after effect cleanup (no AbortController) |
| 4 | ✅ Resolved | `components/interview/InterviewSplitView.tsx` | `reset()` fires while previous flush in flight |
| 5 | ✅ Resolved | `components/chat/ChatPanel.tsx` | Activation effect races with deactivation |
| 6 | ✅ Resolved | `hooks/useCanvasReview.ts` | Double-evaluate with concurrent clicks |
| 7 | ✅ Resolved | `hooks/useAuthHandoff.ts` | Handoff API completes after component unmount |
| 8 | ℹ️ Guarded | `stores/workspaceStore.ts` | Transition table prevents invalid transitions |
| 9 | ℹ️ Guarded | `components/PostAuthRoot.tsx` | `bootstrapCalledRef` prevents double-fire |
| 10 | ✅ Resolved | `hooks/useSessionContent.ts` | Staleness guard on `loadingCanvasSessionIdRef` — replaced by session AbortController |
| 11 | ✅ Resolved | `hooks/useSessionContent.ts` | Staleness guard on `loadingTranscriptSessionIdRef` — replaced by session AbortController |
| 12 | ℹ️ Guarded | `hooks/useConclusionRequest.ts` | `conclusionRequestedRef` dedup guard |
| 13 | ℹ️ Guarded | `components/chat/ChatPanel.tsx` | `terminateHandledRef` prevents duplicate toasts |
| 14 | ✅ Resolved | `stores/anonymousWorkspaceStorage.ts` | Local-mode snapshot persistence — same fix as #1, applied to localStorage path |

---

## Detailed Findings

### 1. ✅ RESOLVED — Persistence lifecycle: flush reads mutable state in fire-and-forget

**File:** `lib/persistenceLifecycle.ts`, lines 61–82  
**Status:** Resolved via **Change A (Snapshot Persistence)**.

The API-mode write closure previously read `useCanvasStore.getState().getCanvasState()` at **write-execution time**, making it vulnerable to cross-session data corruption if a session swap occurred between `markDirty()` and the deferred write.

**Fix applied:** A `snapshot` variable is captured in the store subscription callback (at `markDirty` time). The write closure uses this frozen snapshot instead of reading live state:

```ts
let snapshot: CanvasState = useCanvasStore.getState().getCanvasState();
current = createPersistence(async () => {
  // uses snapshot, not live store state
  await Effect.runPromise(Effect.either(saveCanvasApi(sessionId, snapshot)));
  ...
});
storeUnsubs = [
  useCanvasStore.subscribe(() => {
    snapshot = useCanvasStore.getState().getCanvasState(); // capture at change time
    current.markDirty();
  }),
];
```

Two new tests verify the behavior:
- "uses snapshot captured at markDirty time, not live store state"
- "snapshot updates on subsequent markDirty calls"

---

### 2. ✅ RESOLVED — ChatPanel activation effect revives terminated session on remount

**File:** `components/chat/ChatPanel.tsx`, lines 367–375  
**Status:** Resolved. The activation effect now only fires from `loading-session`, never from `inactive`. The `isActive` prop (renamed from `isConcluded`, with inverted semantics) controls whether the session starts inactive on mount. The effect guard is:

```ts
if (sessionId && isActive) {
  const p = getPhase();
  if (p === "loading-session") {
    activateSession();
  }
}
```

This eliminates the revive-on-remount race: if the session was deactivated (by time expiry, user action, or AI termination), phase is `inactive` and the effect does not re-activate it. Only an explicit user action (spending a token) can transition `inactive → active`.

---

### 3. ✅ RESOLVED — Canvas fetch completes after effect cleanup / session switch

**File:** `hooks/useSessionContent.ts`  
**Status:** Resolved via **Change B (Session-scoped AbortController)**.

Content fetches (`fetchCanvas`, `fetchTranscript`) now receive the session-scoped `AbortSignal` via `getSessionSignal()`. When the user switches sessions (`loadSession`), the previous session's controller is aborted, which:

1. Cancels in-flight HTTP requests (the `fetch()` call receives the signal)
2. The `.then` callback checks `signal?.aborted` before writing state

This replaces the manual `loadingCanvasSessionIdRef` / `loadingTranscriptSessionIdRef` staleness guards with a structural mechanism that also handles unmount and same-sessionId remount edge cases.

**Implementation:**
- `stores/workspaceStore.ts`: Module-level `sessionController`, created on `loadSession`, aborted on `loadSession` (replacing) and `reset`
- `services/sessionsClient.ts`: `apiGet` accepts optional `{ signal }`, piped through `fetchCanvas` and `fetchTranscript`
- `hooks/useSessionContent.ts`: Reads signal via `getSessionSignal()`, passes to fetches, checks `signal?.aborted` in callbacks

Four new tests verify abort behavior in `workspaceStore.test.ts`.

---

### 4. ✅ RESOLVED — InterviewSplitView: `reset()` fires while previous persistence flush is in flight

**File:** `components/interview/InterviewSplitView.tsx`  
**Status:** Resolved via **Change A (Snapshot Persistence)**.

The fire-and-forget flush from `teardownPersistence()` / `swapPersistence()` is now safe: the old write closure uses a snapshot captured at `markDirty()` time, not live store state. Even if the old flush executes after the new session's data has been loaded into the canvas store, the old writer writes its frozen snapshot — not the new session's data. Two concurrent persistence writers cannot cause cross-contamination because each writer's data is captured at the time of the change, not at the time of the write.

---

### 5. ✅ RESOLVED — ChatPanel activation effect races with deactivation

**File:** `components/chat/ChatPanel.tsx`, lines 367–375  
**Concurrent operations:**
- Activation effect: when `sessionId` is truthy and `isActive`, calls `activateSession()` if phase is `loading-session`
- Deactivation paths: when timer elapses, calls `deactivateSession()` (via `useConclusionRequest`)
- These effects both read phase and attempt transitions

**Symptom:** Consider this sequence:
1. Session page loads with `isActive=true`, phase is `loading-session`
2. Activation effect fires → `activateSession()` → phase = `active`
3. Timer expires immediately → `deactivateSession()` → phase = `inactive`
4. React re-renders; activation effect re-runs (deps unchanged) → **no re-fire** (stable deps)

This is safe because: (a) the activation effect only fires from `loading-session`, not `inactive`, and (b) the deps `[sessionId, isActive]` don't change so it won't re-fire.

**Status:** ✅ **Resolved** by the structural fix (activation only from `loading-session`). The `isActive` prop is server-rendered and doesn't change during the component's lifetime. If the component remounts after deactivation (e.g. HMR, key change), the activation effect sees phase is `inactive` and does not re-activate. Safe.

---

### 6. ✅ RESOLVED — useCanvasReview: double-evaluate on concurrent clicks

**File:** `hooks/useCanvasReview.ts`
**Status:** Resolved.

Added `isEvaluatingRef` (synchronous guard) alongside the existing `isEvaluating` state (for UI). The `evaluate` callback now checks `isEvaluatingRef.current` first and sets it synchronously before the async work begins. This prevents two `fetch("/api/chat")` requests from firing on a same-tick double-click.

The `isEvaluating` React state dep was also removed from the `useCallback` deps array — the ref-based guard makes it unnecessary, and removing it prevents the function identity from changing on every evaluating state toggle.

---

### 7. ✅ RESOLVED — useAuthHandoff: handoff API completes after component unmount

**File:** `hooks/useAuthHandoff.ts`
**Status:** Resolved.

Added a `mountedRef` that is set to `false` in an effect cleanup. All three async callbacks (`onTranscriptSaveError`, `onCanvasSaveError`, `onHandoffComplete`) now check `mountedRef.current` before updating React state or store state. `toast.dismiss()` is still called unconditionally (safe to call after unmount). This prevents React state-update-on-unmounted-component warnings.

---

### 8. ℹ️ Guarded: workspaceStore transition table

**File:** `stores/workspaceStore.ts`, lines 5–9  
**Analysis:** Every transition calls `guardTransition()` which throws on invalid transitions. Since Zustand `set` and `get` are synchronous and JS is single-threaded, there's no TOCTOU between `get().phase` and `set()` within the same store method.

**Guard status:** ✅ **Properly guarded.** The state machine cannot reach an invalid state through concurrent calls because each method is a synchronous `get → guard → set` in the same microtask.

---

### 9. ℹ️ Guarded: PostAuthRoot bootstrapCalledRef

**File:** `components/PostAuthRoot.tsx`, lines 38–40  
**Analysis:** `bootstrapCalledRef.current` is checked and set synchronously at the top of the effect. React Strict Mode double-mount would fire the effect twice — the ref prevents the second invocation.

**Guard status:** ✅ **Properly guarded.** Refs are synchronously checked before any async work.

---

### 10–11. ✅ RESOLVED — useSessionContent staleness refs replaced by session AbortController

**File:** `hooks/useSessionContent.ts`  
**Status:** Resolved via **Change B (Session-scoped AbortController)**.

The `loadingCanvasSessionIdRef` and `loadingTranscriptSessionIdRef` staleness guards have been removed. Their function is now served by the session-scoped `AbortSignal`:

- The signal is obtained via `getSessionSignal()` at fetch-start time
- Passed to `fetchCanvas(sessionId, { signal })` and `fetchTranscript(sessionId, { signal })`
- In the `.then` callback, `signal?.aborted` is checked before writing state
- On session switch, `loadSession()` aborts the previous signal, causing in-flight fetches to be cancelled at the HTTP level

This provides stronger guarantees than the ref-based approach: it handles unmount and same-sessionId remount in addition to session-switch, and it actually cancels the HTTP request (saving bandwidth and server resources).

---

### 12. ℹ️ Guarded: useConclusionRequest dedup ref

**File:** `hooks/useConclusionRequest.ts`, line 131  
**Analysis:** `conclusionRequestedRef.current` is set synchronously before the async `requestConclusion`. This prevents double-fire even if the effect dependency array triggers again.

**Guard status:** ✅ **Properly guarded against double-fire.** See Finding #5 for the stale-messages concern.

---

### 13. ℹ️ Guarded: ChatPanel terminateHandledRef

**File:** `components/chat/ChatPanel.tsx`, lines 389–413  
**Analysis:** Uses a `Set<string>` keyed by `${messageId}-${invocationIndex}` to prevent processing the same terminate_interview tool call twice.

**Guard status:** ✅ **Properly guarded.**

---

### 14. ✅ RESOLVED — anonymousWorkspaceStorage: local-mode snapshot persistence

**File:** `stores/anonymousWorkspaceStorage.ts`, `lib/persistenceLifecycle.ts`  
**Status:** Resolved.

**Original assessment:** The localStorage read/write is synchronous and was considered safe. However, reassessment revealed the same latent snapshot gap as Finding #1: the local-mode write closure in `persistenceLifecycle.ts` called `persistAnonymousWorkspace()`, which read **live Zustand state** via `getState()` at write-execution time — not at the time the store change was detected. If a session swap occurred between the subscription callback (which calls `markDirty()`) and the deferred write (which calls the write closure), the old writer would read the new session's data.

**Fix applied:** Refactored `anonymousWorkspaceStorage.ts` into three functions:

1. `captureAnonymousSnapshot()` — reads both `canvasStore` and `authHandoffStore` state, returns a frozen `PersistedAnonymousWorkspace` object
2. `persistAnonymousWorkspaceFromSnapshot(state)` — writes a pre-captured snapshot to localStorage (no store reads)
3. `persistAnonymousWorkspace()` — backward-compatible wrapper that calls both (for non-lifecycle callers)

Updated `persistenceLifecycle.ts` local mode to mirror the API-mode snapshot pattern:

```ts
let localSnapshot = captureAnonymousSnapshot();
current = createPersistence(async () => {
  persistAnonymousWorkspaceFromSnapshot(localSnapshot);
});
storeUnsubs = [
  useCanvasStore.subscribe(() => {
    localSnapshot = captureAnonymousSnapshot();
    current.markDirty();
  }),
  useAuthHandoffStore.subscribe(() => {
    localSnapshot = captureAnonymousSnapshot();
    current.markDirty();
  }),
];
```

Both local and API modes now follow the same snapshot-at-dirty-time pattern.

---

## Prioritised Action List

### Priority 1 — Resolved

1. **Finding #1 (persistence flush race):** ✅ **Resolved via Change A.** The write closure now uses a snapshot captured at `markDirty()` time instead of reading `getState()` at write-time. Two tests verify correct behavior.

2. **Finding #2 (activation revives terminated session):** ✅ **Resolved.** The activation effect now only fires from `loading-session`. The `isActive` prop (server-rendered) controls whether the session starts active on mount. `inactive → active` requires explicit user action (spending a token).

### Priority 2 — Resolved

3. **Finding #3 (canvas fetch after unmount):** ✅ **Resolved via Change B.** Session-scoped `AbortController` cancels in-flight fetches on session switch. Signal passed through `apiGet → fetchCanvas / fetchTranscript`. Four tests verify abort behavior.

4. **Finding #4 (reset during in-flight flush):** ✅ **Resolved via Change A.** The old writer's snapshot is frozen — even if the flush executes after new session data is loaded, the old writer writes its frozen snapshot.

### Priority 3 — Monitor / low risk

5. **Finding #5 (activation vs deactivation race):** ✅ **Resolved** by the structural fix. The activation effect only fires from `loading-session`, so even if deactivation fires first, the subsequent activation effect won't revive the session.

6. **Finding #6 (double-evaluate):** ✅ **Resolved.** Added `isEvaluatingRef` as synchronous guard alongside React state. Prevents duplicate `fetch` calls on same-tick double-clicks.

7. **Finding #7 (handoff after unmount):** ✅ **Resolved.** Added `mountedRef` checked before state updates in async callbacks.

---

## Structural Prevention — Coding Rules for Race-Free Code

This section codifies patterns that prevent race conditions at design time. These rules should be treated as hard requirements (like the existing copilot-instructions) for any code that touches async operations, React effects, or Zustand store transitions.

### Rule 1: Never read mutable state inside a deferred write

**Anti-pattern:**
```ts
// ❌ BAD: reads live state when flush eventually runs
const write = async () => {
  const data = useCanvasStore.getState().getCanvasState();
  await saveCanvasApi(sessionId, data);
};
```

**Correct pattern:**
```ts
// ✅ GOOD: snapshot captured at dirty-mark time
function markDirty() {
  state.snapshot = useCanvasStore.getState().getCanvasState();
  state.isDirty = true;
  scheduleWrite();
}
const write = async () => {
  await saveCanvasApi(sessionId, state.snapshot);
};
```

**Why:** A deferred write (debounced, fire-and-forget, queued) may execute milliseconds or seconds after the store was modified. By that time a different session's data could be in the store. Capture the data at the moment it becomes dirty; write the snapshot, not live state.

---

### Rule 2: Every async fetch in a `useEffect` must use `AbortController`

**Anti-pattern:**
```ts
// ❌ BAD: no cancellation, stale response silently writes state
useEffect(() => {
  void fetchCanvas(sessionId).then(data => setCanvasState(data));
}, [sessionId]);
```

**Correct pattern:**
```ts
// ✅ GOOD: effect cleanup aborts in-flight fetch
useEffect(() => {
  const controller = new AbortController();
  fetchCanvas(sessionId, { signal: controller.signal })
    .then(data => {
      if (!controller.signal.aborted) setCanvasState(data);
    })
    .catch(e => {
      if (e.name !== 'AbortError') throw e;
    });
  return () => controller.abort();
}, [sessionId]);
```

**Why:** React effects can re-fire before the previous invocation's async work completes. Without cancellation, the old fetch's `.then` writes stale data into the store. `AbortController` is the standard mechanism — pass the signal through the fetch chain/Effect pipeline, and abort in the cleanup function.

---

### Rule 3: Use refs (not React state) for synchronous guards

**Anti-pattern:**
```ts
// ❌ BAD: React state guard — batched, not visible in same tick
const [isRunning, setIsRunning] = useState(false);
const handleClick = () => {
  if (isRunning) return;        // second click in same tick sees old value
  setIsRunning(true);           // batched — not committed yet
  doExpensiveWork();
};
```

**Correct pattern:**
```ts
// ✅ GOOD: ref guard is synchronous
const isRunningRef = useRef(false);
const [isRunning, setIsRunning] = useState(false); // for UI only
const handleClick = () => {
  if (isRunningRef.current) return;
  isRunningRef.current = true;
  setIsRunning(true);           // for button disable / spinner
  doExpensiveWork().finally(() => {
    isRunningRef.current = false;
    setIsRunning(false);
  });
};
```

**Why:** React's `setState` is batched — the new value isn't visible until the next render. If two events fire in the same tick (double-click, rapid keystrokes), both see the old state. Refs update synchronously and are visible immediately. Use the ref for the guard, keep state for the UI.

---

### Rule 4: Deactivation is unconditional on user-intent actions

**Anti-pattern:**
```ts
// ❌ BAD: early-return skips deactivation
const requestEndInterview = () => {
  if (conclusionRequestedRef.current) return;   // auto-expire already fired
  conclusionRequestedRef.current = true;
  deactivate();                                  // never reached!
};
```

**Correct pattern:**
```ts
// ✅ GOOD: deactivate before any guard
const requestEndInterview = () => {
  deactivate();                                  // always fires
  if (conclusionRequestedRef.current) return;
  conclusionRequestedRef.current = true;
  // ... conclusion stream logic
};
```

**Why:** When the user clicks "End Interview", the session must become inactive *regardless* of whether auto-expiry already started the conclusion flow. The guard prevents duplicate API calls — but deactivation is about UI state, not API deduplication. Always deactivate first, then guard against duplicate work.

---

### Rule 5: Activation effects must check for prior termination

**Anti-pattern:**
```ts
// ❌ BAD: blindly activates if phase is "inactive"
useEffect(() => {
  if (sessionId && isActive) {
    const p = getPhase();
    if (p === "loading-session" || p === "inactive") {
      activateSession();    // revives a terminated session!
    }
  }
}, [sessionId, isActive]);
```

**Correct pattern:**
```ts
// ✅ GOOD: only activates from loading-session, never from inactive
useEffect(() => {
  if (sessionId && isActive) {
    const p = getPhase();
    if (p === "loading-session") {
      activateSession();
    }
  }
}, [sessionId, isActive]);
```

**Why:** `inactive` means the session is not currently active. Only an explicit user action (spending a token) may transition `inactive → active`. An activation effect that treats `inactive` as "not yet active" will accidentally revive terminated sessions. Only `loading-session` (initial load) is a valid precondition for automatic activation.

---

### Rule 6: Await flushes before swapping persistence instances

**Anti-pattern:**
```ts
// ❌ BAD: fire-and-forget flush — new instance can race old write
void prev.flush().finally(() => prev.destroy());
current = createPersistence(newMode);
```

**Correct pattern:**
```ts
// ✅ GOOD: old instance fully drained before new one starts
await prev.flush();
prev.destroy();
current = createPersistence(newMode);
```

**Why:** If the old instance's `write` callback executes after the new instance starts receiving `markDirty` calls, two writers are active simultaneously. The old writer may read new-session data from the store and write it to the old endpoint. Either `await` the flush, or use Rule 1 (snapshot at dirty-mark time) so the old writer can't read new data.

---

### Rule 7: Zustand store transitions are synchronous — use them as atomic guards

The workspace phase state machine (`guardTransition`) is already correct:

```ts
// ✅ This pattern is safe — single-threaded, synchronous get→guard→set
const activateSession = () => {
  const current = get().phase;
  guardTransition(current, "active");
  set({ phase: { phase: "active" } });
};
```

**Why it's safe:** JavaScript is single-threaded. `get()`, `guardTransition()`, and `set()` all execute in the same microtask. No other code can interleave between the read and write. Zustand's `set` is synchronous (it calls subscribers synchronously).

**Rule:** All state-machine transitions must go through a synchronous `get → guard → set` sequence in a single store method. Never split this across async operations, and never read phase in one tick and transition in a callback.

---

### Summary: Checklist for PR Review

Before approving any PR that touches async operations, effects, or store state:

- [ ] **No `void promise`** in lifecycle code — either `await` the promise or prove the write closure uses a frozen snapshot
- [ ] **Every `useEffect` with async work** has an `AbortController` in its cleanup
- [ ] **Guards (dedup, re-entry prevention)** use refs, not React state
- [ ] **Deactivation calls** happen before guard checks in user-intent handlers
- [ ] **Activation effects** do not activate from `inactive` — only from `loading-session`
- [ ] **`swapPersistence` / teardown** awaits the old instance's flush (or uses snapshots)
- [ ] **Store transitions** are synchronous single-method `get → guard → set` — no async gaps
