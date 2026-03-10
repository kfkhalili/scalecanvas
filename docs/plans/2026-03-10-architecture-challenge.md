# Architecture Challenge: Burn It Down and Rebuild Right

**Date:** 2026-03-10
**Status:** ✅ **COMPLETE** — All 8 migration steps delivered across commits `36c2486`…`0a3a478` on branch `feat/handoff-canvas-persistence`.
**Context:** Pre-production prototype. No users. No migrations to protect. Everything is on the table.

---

## Completion Summary

| Migration Step | Status | Commit(s) |
|----------------|--------|-----------|
| 1. Extract `PersistenceService` interface + `createLocalPersistence` | ✅ Done | `36c2486` |
| 2. Move anonymous debounce/flush into persistence layer | ✅ Done | `36c2486` |
| 3. Create `createApiPersistence` wrapping `saveCanvasApi` | ✅ Done | `36c2486` |
| 4. Add `saveStatus` to canvas + `data-save-status` in DOM | ✅ Done | `36c2486` |
| 5. Model `WorkspacePhase` discriminated union in `workspaceStore` | ✅ Done | `36c2486` |
| 6. Move orchestration out of InterviewSplitView | ✅ Done | `0a3a478` (`useSessionContent` extraction) |
| 7. Decide Effect vs async/await | ✅ Decided: Keep Effect (justified per [effect audit](2026-03-10-effect-audit.md)) | `60bc2d9` |
| 8. Switch FlowCanvas to controlled mode | ✅ Done | `7c7b42d` |

### Outcomes vs Promises

| Promise ("What This Gets You") | Outcome |
|-------------------------------|---------|
| 200 lines of orchestration in components → ~50 lines | InterviewSplitView: 266→117 lines. PostAuthRoot: merged 2 effects into 1. |
| 12 variables encoding 5 states → 1 discriminated union | `WorkspacePhase` in `stores/workspaceStore.ts` with `ts-pattern` exhaustive match |
| 2 divergent persistence codepaths → 1 interface | `PersistenceService` in `lib/persistence.ts`, 2 implementations |
| Fire-and-forget saves → observable state | `PersistState` { isDirty, isSaving, lastSavedAt, error } |
| Magic sleeps in E2E → deterministic waits | `data-save-status` attribute; `expect.poll` and `waitForSelector` |
| Effect decision | Kept — zero anti-patterns per [effect audit](2026-03-10-effect-audit.md) |
| Reference-equality sync loop → controlled ReactFlow | Controlled mode; store is single source of truth |
| 7 queueMicrotask calls → explicit transitions | 0 queueMicrotask calls remaining |

---

## The Diagnosis

The code smells audit catalogued 14 symptoms. But symptoms are not the disease. The disease is **five structural mistakes** that make every new feature harder to write correctly. Patching the symptoms (adding `beforeunload` here, a status filter there) is what got us here. Let's stop patching.

---

## Structural Problem 1: Components Are Doing I/O Orchestration

The project's own Rule #3 says:

> *Business logic lives in `lib/` and `services/`. Components only render and dispatch — no business decisions or side-effect orchestration inside components.*

Here's what actually happens:

| Component | Lines of I/O orchestration |
|-----------|---------------------------|
| `InterviewSplitView.tsx` | ~130 lines: debounce persist, localStorage flush, `beforeunload`, `fetchCanvas`, `fetchTranscript`, session-switch save, handoff detection, transcript pre-fill, staleness guards |
| `FlowCanvas.tsx` | ~30 lines: debounce save timer, `saveCanvasApi` fire-and-forget, reference-equality sync loop |
| `PostAuthRoot.tsx` | ~40 lines: `loadAnonymousWorkspace`, `getUser`, bootstrap decision, handoff trigger |

**That's 200 lines of orchestration living inside React render trees.** Components should call one function ("save"), not own the debounce timer, the flush logic, the beforeunload listener, the retry policy, and the error handling.

**Why this matters:** React's lifecycle is the wrong place for persistence guarantees. `useEffect` cleanup doesn't run on hard reload. Refs don't survive HMR. `queueMicrotask` ordering is fragile. Every time we add a feature that touches save/load, we have to think about React's mounting semantics instead of our domain.

---

## Structural Problem 2: The State Machine is Implicit

The session lifecycle is a state machine:

```
anonymous → handoff-pending → handoff-in-progress → authenticated → concluded
```

But it's never modelled as one. Instead, the "current state" is the conjunction of:

- `sessionId` prop (string | undefined)
- `isAnonymous` prop (boolean)
- `pendingSessionId` in authHandoffStore (Option<string>)
- `handoffTranscript` in authHandoffStore (Option<HandoffTranscript>)
- `handoffDoneRef` in useAuthHandoff (string | null)
- `bootstrapCalledRef` in PostAuthRoot (boolean)
- `canvasReady` local state in InterviewSplitView (boolean)
- `handoffReady` local state in InterviewSplitView (boolean)
- `storesReady` local state in PostAuthRoot (boolean)
- `loadingCanvasSessionIdRef` in InterviewSplitView (string | null)
- `loadingTranscriptSessionIdRef` in InterviewSplitView (string | null)
- `isSessionActive` in sessionStore (boolean)

That's **12 pieces of distributed state** encoding **5 lifecycle states**. They can hold combinations that shouldn't exist (e.g. `pendingSessionId = Some("x")` but `canvasReady = false` and `handoffDoneRef = "x"`). There are 7 `queueMicrotask` calls whose sole purpose is to sequence state transitions that should be atomic.

**Why this matters:** Every new developer (or your future self) has to mentally simulate the interleaving of 12 variables across 3 components and 2 stores to understand what will happen when a user logs in with an existing canvas. The debounce race condition we just fixed was a direct consequence: state transitioned (component unmounted) before the persistence side-effect had completed, because there's no explicit transition that says "flush before leaving this state."

---

## Structural Problem 3: Two Persistence Codepaths for the Same Data

Anonymous canvas lives in localStorage. Authenticated canvas lives in Supabase. The code treats these as completely different systems:

| Concern | Anonymous | Authenticated |
|---------|-----------|---------------|
| **Write** | `localStorage.setItem()` (sync) | `PUT /api/sessions/:id/canvas` (async) |
| **Read** | `localStorage.getItem()` (sync) | `GET /api/sessions/:id/canvas` (async) |
| **Debounce** | 500ms in InterviewSplitView | 800ms in FlowCanvas |
| **Flush** | `beforeunload` (InterviewSplitView) | None (FlowCanvas) |
| **Retry** | None | None (save result discarded) |
| **Error handling** | Toast once on quota | Result silently discarded |
| **Dirty tracking** | None | None |
| **Owner** | InterviewSplitView | FlowCanvas |

The anonymous path has a flush-on-unload fix. The authenticated path has the **exact same bug, unfixed**. The anonymous path has 500ms debounce. The authenticated path has 800ms. There's no principled reason for any of these differences — they're accidental, introduced by different authors at different times.

**Why this matters:** Any fix applied to one path must be manually replicated to the other. This is the exact category of bug that shipped us the debounce race condition. Two codepaths for one operation is a duplication smell, and duplication breeds divergence.

---

## Structural Problem 4: Effect Is Used as a Glorified try/catch

The project pulls in the Effect library — a powerful toolkit for typed errors, managed resources, structured concurrency, dependency injection, scheduling, and retry. Here's how it's actually used:

```typescript
// Every single call site:
void Effect.runPromise(Effect.either(someEffect)).then((either) => {
  Either.match(either, { onLeft: ..., onRight: ... });
});
```

That's `Promise.resolve().then()` with extra steps. The entire value proposition of Effect — Layers for DI, Scope for resource cleanup, Schedule for retry/debounce, Fiber for structured concurrency, Queue for backpressure — is unused.

Meanwhile, the codebase hand-rolls:
- **Retry:** `saveWithBackoff()` in `lib/authHandoff.ts` — 15 lines reimplementing `Effect.retry(Schedule.exponential(600))`
- **Debounce:** `setTimeout` + `clearTimeout` + `flushPersist` — reimplementing `Effect.schedule(Schedule.spaced(500))`
- **Resource cleanup:** `window.addEventListener('beforeunload', ...)` + `useEffect` cleanup — reimplementing `Effect.acquireRelease`

**The indictment:** Effect adds ~50KB to the bundle and significant cognitive overhead (pipe, flatMap, Either.match at every boundary). If you're going to pay that cost, use the features. If you're not going to use the features, drop it for plain async/await and a `Result<T, E>` type.

---

## Structural Problem 5: Zustand Stores Are Passive Data Bags

Every store follows the same pattern:

```typescript
type XStore = {
  value: T;
  setValue: (v: T) => void;
};
```

No computed state. No side effects. No middleware. No actions beyond "set this field." The stores are React state lifted into a global, nothing more.

This means:
- **No dirty tracking** — nobody knows if canvas has unsaved changes
- **No save lifecycle** — nobody knows if a save is in flight or failed
- **No coordination** — stores don't know about each other; InterviewSplitView is the glue code

Zustand supports middleware (`persist`, `devtools`, `subscribeWithSelector`) and actions that compose reads + writes + side effects. None of this is used.

---

## The Proposal: What to Build Instead

### 1. Model the State Machine Explicitly

Replace the 12 distributed state variables with one discriminated union:

```typescript
type WorkspaceState =
  | { phase: 'loading' }
  | { phase: 'anonymous'; workspace: AnonymousWorkspace }
  | { phase: 'handoff-pending'; sessionId: string; workspace: AnonymousWorkspace }
  | { phase: 'handoff-in-progress'; sessionId: string }
  | { phase: 'authenticated'; sessionId: string }
  | { phase: 'session-switching'; fromId: string; toId: string }
  | { phase: 'concluded'; sessionId: string; summary: string };
```

One store. One `phase` field. Transitions are explicit functions that validate preconditions:

```typescript
function startHandoff(state: WorkspaceState, sessionId: string): WorkspaceState {
  if (state.phase !== 'anonymous') throw new Error(`Cannot handoff from ${state.phase}`);
  return { phase: 'handoff-pending', sessionId, workspace: state.workspace };
}
```

No refs. No booleans. No `queueMicrotask`. Components read `phase` and render the right thing. Transitions are tested with pure functions, not by simulating React mounts.

### 2. One Persistence Layer, One Interface

```typescript
type PersistenceService = {
  /** Schedule a debounced save. Call on every canvas change. */
  save(data: CanvasState): void;

  /** Immediate save. Call on beforeunload, unmount, session switch. */
  flush(): Promise<void>;

  /** Observable state for UI and tests. */
  readonly state: {
    isDirty: boolean;
    isSaving: boolean;
    lastSavedAt: Date | null;
    error: string | null;
  };

  /** Subscribe to state changes. */
  subscribe(listener: (state: PersistState) => void): () => void;

  /** Dispose timers, listeners, subscriptions. */
  destroy(): void;
};
```

Two implementations:
- `createLocalPersistence()` — wraps localStorage. `save()` debounces, `flush()` writes immediately. `isDirty` tracks whether the store has changed since last write.
- `createApIPersistence(sessionId)` — wraps `saveCanvasApi`. Same interface. Adds `keepalive: true`, retry with backoff.

A factory chooses the implementation based on `phase`:

```typescript
function createPersistence(phase: WorkspaceState['phase'], sessionId?: string): PersistenceService {
  if (phase === 'anonymous') return createLocalPersistence();
  if (sessionId) return createApiPersistence(sessionId);
  return createNullPersistence(); // loading, concluded
}
```

Components call `persistence.save(data)`. They never touch `setTimeout`, `clearTimeout`, `beforeunload`, `localStorage`, or `saveCanvasApi` directly.

Tests wait for `persistence.state.isDirty === false` instead of `page.waitForTimeout(2000)`.

### 3. Decide on Effect: Use It or Lose It

**Option A — Use it properly:**
- Define a `PersistenceService` as an Effect Layer
- Use `Effect.acquireRelease` for the debounce timer (timer is acquired, released on destroy)
- Use `Effect.retry(Schedule.exponential("600 millis").pipe(Schedule.recurs(3)))` instead of `saveWithBackoff`
- Use `Effect.scope` to tie the persistence lifecycle to the component lifecycle
- Use `Effect.queue` for ordered save operations (no interleaving)
- Move `runPromise` to a single boundary (the Zustand middleware or a React provider)

**Option B — Drop it:**
- Replace with plain `async/await` and a 10-line `Result<T, E>` type:
  ```typescript
  type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
  ```
- Keep `pipe` and composition via plain functions
- Save ~50KB from the bundle
- Trade typed effect tracking for simpler call sites

Both are valid. The current middle ground is not — it gives you the complexity tax of Effect with the reliability of raw Promises.

### 4. Make the Canvas Store the Single Source of Truth

Currently: ReactFlow's `useNodesState` is the local source of truth. Changes push to `canvasStore`. External updates pull back from `canvasStore`. Reference-equality circuit breakers prevent echo loops.

Proposed: `canvasStore` is the only truth. ReactFlow receives `nodes` and `edges` as controlled props. Changes flow through store actions:

```typescript
// In the store
onNodesChange: (changes: NodeChange[]) => {
  set(s => ({ nodes: applyNodeChanges(changes, s.nodes) }));
  persistence.save(get().getCanvasState());
},
```

ReactFlow supports controlled mode since v11. One source of truth. No sync loop. No reference-equality hacks. No `lastPushedNodesRef`.

### 5. Domain Actions, Not Dumb Setters

Replace passive setters with domain actions:

```typescript
type CanvasStore = {
  // State
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  saveError: string | null;

  // Domain actions
  applyChanges(nodeChanges: NodeChange[], edgeChanges: EdgeChange[]): void;
  dropNode(type: string, label: string, position: XYPosition): void;
  loadFromServer(state: CanvasState): void;
  markSaving(): void;
  markSaved(): void;
  markError(error: string): void;
};
```

The store knows about its own persistence lifecycle. Components dispatch actions. The debounce/flush/retry logic lives in a middleware or a side-effect subscription, not in `FlowCanvas.tsx`.

---

## Migration Path (If You Don't Want to Rewrite Everything at Once)

| Step | What | Enables |
|------|------|---------|
| 1 | Extract `PersistenceService` interface + `createLocalPersistence` | Testable persistence; `isDirty`/`isSaving` state |
| 2 | Move anonymous debounce/flush from `InterviewSplitView` into `createLocalPersistence` | InterviewSplitView loses 40 lines |
| 3 | Create `createApiPersistence` wrapping `saveCanvasApi` + debounce + flush | FlowCanvas loses 30 lines; authenticated path gets flush-on-unload |
| 4 | Add `saveStatus` to `canvasStore`; expose as `data-save-status` in DOM | E2e tests can replace magic sleeps with `waitForSelector` |
| 5 | Model `WorkspacePhase` discriminated union in a new `workspaceStore` | Replace 12 distributed variables with 1 field |
| 6 | Move orchestration from InterviewSplitView into workspace phase transitions | InterviewSplitView becomes ~50 lines of pure rendering |
| 7 | Decide Effect vs async/await; refactor service layer accordingly | Consistent IO pattern across codebase |
| 8 | Switch FlowCanvas to controlled mode; eliminate sync loop | Remove `lastPushedNodesRef` and related hacks |

Steps 1–4 can be done independently and deliver immediate value (the FlowCanvas debounce bug is fixed at step 3). Steps 5–6 are the big win. Steps 7–8 are polish.

---

## What This Gets You

| Today | After |
|-------|-------|
| 200 lines of orchestration in components | Components are ~50 lines of render + dispatch |
| 12 variables encoding 5 states | 1 discriminated union, 5 explicit states |
| 2 divergent persistence codepaths | 1 interface, 2 implementations, same guarantees |
| Fire-and-forget saves with silent data loss | Observable `isDirty`/`isSaving`/`saveError` for UI and tests |
| Magic sleeps in e2e tests | `waitForSelector('[data-save-status="saved"]')` |
| Effect as a 50KB try/catch wrapper | Either proper Effect (with real benefits) or plain async (with real simplicity) |
| Reference-equality sync loop hacks | 1 source of truth, controlled ReactFlow |
| 7 queueMicrotask calls for sequencing | Explicit state transitions with preconditions |

---

## The Real Question

This isn't "should we refactor." The prototype works — users can draw, chat, save, hand off, conclude. The question is: **when you start building the next 5 features on top of this, will each one require you to reason about 12 state variables, 2 persistence paths, and React lifecycle timing?**

If yes, you're building on sand. Better to spend a week rebuilding the foundation now (when there are zero users and zero migrations) than to spend a month debugging the timing bugs that each new feature will introduce.

If you're going to ship this, ship it on a state machine with a persistence layer. Not on refs and microtasks.
