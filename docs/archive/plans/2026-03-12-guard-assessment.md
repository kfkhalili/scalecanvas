# Race-Condition Audit — Guarded Findings Assessment

Assessment of remaining ref-based guards identified in the race-condition audit.
Evaluates whether each is genuinely required or replaceable by session-scoped
AbortController / snapshot persistence.

---

## Executive Summary

| # | File | Guard | Verdict | Severity |
|---|------|-------|---------|----------|
| 1 | `PostAuthRoot.tsx` | `bootstrapCalledRef` | **Keep** — Strict Mode double-mount guard; AbortController cannot replace | ℹ️ Info |
| 2 | `useConclusionRequest.ts` | `conclusionRequestedRef` | **Keep** — intra-session dedup; AbortController scope is wrong | 🟡 Low |
| 3 | `ChatPanel.tsx` | `terminateHandledRef` (Set) | **Keep** — message-level dedup, not session-scoped at all | ℹ️ Info |
| 4 | `anonymousWorkspaceStorage.ts` | Synchronous localStorage | **Needs fix** — LOCAL mode write closure reads live state, not a snapshot | 🟠 Medium |

---

## 1. `PostAuthRoot.tsx` — `bootstrapCalledRef`

### Code pattern
```tsx
const bootstrapCalledRef = useRef(false);

useEffect(() => {
  if (bootstrapCalledRef.current) return;
  bootstrapCalledRef.current = true;

  useWorkspaceStore.getState().enterBootstrapping();
  // ... async supabase.auth.getUser() → decideBootstrapAction → executeBootstrapAction
}, [router]);
```

### Analysis

This is a **React Strict Mode double-mount guard**. In dev mode, React 18+ mounts → unmounts → remounts effects. Without the ref, `enterBootstrapping()` would fire twice, violating the workspace phase state machine (boot → bootstrapping is one-shot).

**Could the session-scoped AbortController replace it?**
No. The AbortController (`getSessionSignal()`) is scoped to `loadSession` / `reset` calls. At the point `PostAuthRoot` mounts, the workspace is in `boot` phase — `loadSession` hasn't been called yet, so there is no AbortController. The ref protects against re-entry into the bootstrapping state machine, not against stale async results. Even if there were a signal to check, aborting the signal doesn't prevent re-calling `enterBootstrapping()` — the guard needs to be synchronous and imperative.

### Verdict
**Keep as-is.** This is the lightest correct pattern for one-shot mount effects in Strict Mode. No improvement needed.

---

## 2. `useConclusionRequest.ts` — `conclusionRequestedRef`

### Code pattern
```tsx
const conclusionRequestedRef = useRef<string | undefined>(undefined);

// Auto-expiry path:
if (conclusionRequestedRef.current === sessionId) return;
conclusionRequestedRef.current = sessionId;
void Effect.runPromise(Effect.either(requestConclusion(sessionId, { ... })));

// Manual "End Interview" path:
const requestEndInterview = useCallback((): void => {
  deactivate();
  if (conclusionRequestedRef.current === sessionId) return;
  conclusionRequestedRef.current = sessionId;
  // ... requestConclusion
}, [...]);
```

The ref stores the `sessionId` for which a conclusion has been requested. Two call sites check it:
1. The auto-expiry `useEffect` — fires when `remainingMs(session) <= 0` and the session had time on initial load.
2. `requestEndInterview` — the explicit user action.

### Analysis

**Could the session-scoped AbortController replace it?**
No, and here's the subtle reason: the AbortController fires on `loadSession` (session *switch*) and `reset`. But conclusion requests happen **within** a single session's lifetime. The dedup problem is:

- Timer fires → sets ref → fires `requestConclusion`
- User clicks "End Interview" 200ms later → ref already set → skips duplicate

The AbortController doesn't abort on conclusion request — it aborts on session *change*. Using the signal would only prevent stale writes after navigating away, not prevent double-fire within the same session.

However, there is one minor connection: if the user switches sessions while a conclusion request is in-flight, the AbortController *would* cancel that fetch (if `{ signal }` were threaded through). Currently `requestConclusion` does **not** accept a signal. That's a separate (minor) concern — the ref is still needed for same-session dedup.

### Verdict
**Keep the ref.** The AbortController cannot replace intra-session dedup. Optional future improvement: thread `getSessionSignal()` into `requestConclusion` to cancel stale in-flight requests on session switch — but that's additive, not a replacement.

---

## 3. `ChatPanel.tsx` — `terminateHandledRef`

### Code pattern
```tsx
const terminateHandledRef = useRef<Set<string>>(new Set());

useEffect(() => {
  for (const m of messages) {
    const invs = (m as ...).toolInvocations ?? [];
    for (let i = 0; i < invs.length; i++) {
      const inv = invs[i];
      if (inv?.toolName === "terminate_interview") {
        const key = `${m.id ?? ""}-${i}`;
        if (terminateHandledRef.current.has(key)) continue;
        terminateHandledRef.current.add(key);
        toast.error(reason);
        useWorkspaceStore.getState().deactivateSession();
      }
    }
  }
}, [messages]);
```

### Analysis

This is a **message-level dedup guard**. The `messages` array is immutable-append — once a message with a `terminate_interview` tool invocation appears, it stays in the array for the lifetime of the component. Every re-render that triggers `[messages]` would re-process the same tool call, showing duplicate toasts and calling `deactivateSession()` repeatedly.

The key is `messageId + invocationIndex` — purely message-scoped, no session concept at all.

**Could the session-scoped AbortController replace it?**
No. This has nothing to do with session lifecycle. The Set deduplicates against re-processing *the same messages array entries*, not against cross-session races. An AbortController cannot prevent a `for` loop from re-processing an already-seen entry.

**Could anything else replace it?**
In theory, the messages could be marked as "handled" by mutating a property on them, but that violates immutability rules. Another approach would be to track a "last processed message index," but that's fragile with non-linear message array mutations. The Set is the correct, minimal pattern.

The Set is never cleared — it grows for the lifetime of the component. This is fine because `ChatPanel` remounts on session navigation (different `sessionId` prop), so the Set resets naturally.

### Verdict
**Keep as-is.** This is the correct and minimal pattern for message-level dedup. No connection to session AbortController or snapshot persistence.

---

## 4. `anonymousWorkspaceStorage.ts` + LOCAL mode persistence

### Code pattern — `persistAnonymousWorkspace()`
```tsx
export function persistAnonymousWorkspace(): void {
  const canvas = useCanvasStore.getState();   // ← reads LIVE state
  const handoff = useAuthHandoffStore.getState(); // ← reads LIVE state

  const state: PersistedAnonymousWorkspace = {
    anonymousMessages: handoff.anonymousMessages,
    questionTitle: Option.getOrNull(handoff.questionTitle),
    nodes: [...canvas.nodes],
    edges: [...canvas.edges],
    // ...
  };
  localStorage.setItem(ANONYMOUS_WORKSPACE_KEY, JSON.stringify({ state, version: 0 }));
}
```

### Code pattern — LOCAL mode write closure in `persistenceLifecycle.ts`
```tsx
if (mode === "local") {
  current = createPersistence(
    async () => {
      persistAnonymousWorkspace(); // ← called at WRITE time, reads live state
    },
  );
  storeUnsubs = [
    useCanvasStore.subscribe(() => current.markDirty()),
    useAuthHandoffStore.subscribe(() => current.markDirty()),
  ];
}
```

Compare with the **API mode** (already fixed with snapshot):
```tsx
let snapshot: CanvasState = useCanvasStore.getState().getCanvasState();
current = createPersistence(async () => {
  // uses `snapshot` captured at subscribe time, not live state
  saveCanvasApi(sessionId, snapshot);
});
storeUnsubs = [
  useCanvasStore.subscribe(() => {
    snapshot = useCanvasStore.getState().getCanvasState(); // capture on change
    current.markDirty();
  }),
];
```

### Analysis

**Does snapshot persistence (Change A) help LOCAL mode automatically?**
No. The API mode explicitly captures `snapshot` in the subscribe callback and uses it in the write closure. The LOCAL mode passes `persistAnonymousWorkspace()` directly — which reads live `useCanvasStore.getState()` at write time, not at `markDirty()` time.

**Is this a real risk?**
The risk is lower than API mode because:
1. LOCAL mode is anonymous-only — there are no session switches (anonymous has one implicit session).
2. `localStorage.setItem` is synchronous — there's no async gap between read and write.
3. The debounce delay means writes happen after state settles.

However, there is one scenario where it matters: if a user is anonymous, edits the canvas, and then **signs in** (triggering `swapPersistence` from `local` → `api`), the teardown sequence is:

```
swapPersistence("api", sessionId) →
  prev.flush() →               // fires persistAnonymousWorkspace()
    reads live state            // which may already be cleared/modified by the
                                // loadSession transition
  prev.destroy()
```

In practice, `loadAnonymousWorkspace()` runs before `swapPersistence` and the auth handoff copies state out first, so the live state is probably still intact at flush time. But the pattern is **structurally incorrect** — it relies on ordering assumptions rather than snapshots.

### Verdict
**🟠 Medium — apply snapshot treatment to LOCAL mode.** The fix would mirror the API mode pattern:

```tsx
if (mode === "local") {
  let localSnapshot = {
    canvas: useCanvasStore.getState(),
    handoff: useAuthHandoffStore.getState(),
  };
  current = createPersistence(async () => {
    persistAnonymousWorkspaceFromSnapshot(localSnapshot);
  });
  storeUnsubs = [
    useCanvasStore.subscribe(() => {
      localSnapshot = { ...localSnapshot, canvas: useCanvasStore.getState() };
      current.markDirty();
    }),
    useAuthHandoffStore.subscribe(() => {
      localSnapshot = { ...localSnapshot, handoff: useAuthHandoffStore.getState() };
      current.markDirty();
    }),
  ];
}
```

This would require adding a `persistAnonymousWorkspaceFromSnapshot(snapshot)` variant that takes state as an argument instead of reading live stores.

---

## Prioritised Action List

| Priority | Action | Risk if deferred |
|----------|--------|------------------|
| 1 | Apply snapshot treatment to LOCAL mode persistence write closure | Data could be written from wrong state during anonymous → authenticated transition |
| 2 | (Optional) Thread `getSessionSignal()` into `requestConclusion` for stale-fetch cancellation | Minor — in-flight conclusion result for old session could arrive after switch, but dedup ref handles state writes |
| 3 | No action needed on `bootstrapCalledRef`, `terminateHandledRef`, or `conclusionRequestedRef` | N/A — all are correct and minimal |

---

## Connection Summary

| Guard | Connected to AbortController? | Connected to snapshot persistence? |
|-------|-------------------------------|-------------------------------------|
| `bootstrapCalledRef` | No — fires before any session exists | No |
| `conclusionRequestedRef` | No — intra-session scope, controller is inter-session | No |
| `terminateHandledRef` | No — message-level, no session concept | No |
| `persistAnonymousWorkspace` | No | **Yes — needs snapshot treatment like API mode** |
