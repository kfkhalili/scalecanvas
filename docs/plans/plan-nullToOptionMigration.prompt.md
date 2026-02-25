# Architecture Review: Null-to-Effect-Option Migration

## 1. Executive Summary

The codebase (ScaleCanvas) has **substantially migrated** from `null`/`neverthrow` to Effect's `Option` and `Effect` modules. `neverthrow` is fully removed. **84 files** now import from `"effect"`, with ~279 `Option` call-sites vs only **48 production `null` occurrences** (the migration is ~85% complete).

However, the migration has a structural problem: **the developer introduced Option as a wrapper but frequently round-trips back to `null`** at boundaries, creating ceremony without safety. The remaining `null`s fall into well-defined categories, ~12 of which are actionable.

### Verdict

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Import consistency | ✅ A | 100% barrel imports from `"effect"`, consistent `Option`/`Effect`/`Either` namespaces |
| Store layer | ✅ A | All Zustand stores use `Option` for nullable state |
| Pure logic (lib/) | ✅ A | `csrf.ts`, `chatGuardrails.ts`, `userProfile.ts`, `userPreferences.ts`, `stripe.ts` are exemplary |
| Service layer | ⚠️ C | Heavy Option→null bounce in `sessions.ts`, `handoff.ts`, `tokensClient.ts` |
| Component layer | ⚠️ B- | Overuse of `Option.match` for imperative side-effects; `Option` refs add ceremony |
| Root types | 🔴 D | `Session.title: string \| null` is the cascade root — forces `null` through 6+ layers |
| Test patterns | ✅ B+ | Consistent `isNone`/`isSome`/`getOrNull` assertions |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  React Components (FlowCanvas, ChatPanel, CollapsibleSidebar, etc.) │
│  ─ consume Option<T> from Zustand stores                            │
│  ─ Option.match for conditional rendering                           │
├──────────────────────────────────────────────────────────────────────┤
│  Zustand Stores (sessionStore, canvasStore, authHandoffStore, etc.) │
│  ─ state typed as Option<T>                                         │
│  ─ serialization boundaries: Option → null → localStorage → Option  │
├──────────────────────────────────────────────────────────────────────┤
│  Client Services (sessionsClient, checkoutClient, tokensClient)     │
│  ─ Effect<T, E> return types                                        │
│  ─ Option params at API call-sites → getOrNull for JSON bodies      │
├──────────────────────────────────────────────────────────────────────┤
│  Server Services (sessions.ts, tokens.ts, handoff.ts)               │
│  ─ Effect<T, E> pipelines with pipe()                               │
│  ─ Supabase responses: fromNullable → immediate match/getOrElse     │
├──────────────────────────────────────────────────────────────────────┤
│  Supabase (RLS, RPC, PostgreSQL)                                    │
│  ─ database.types.ts: auto-generated, full of `| null`              │
│  ─ DbInterviewSession.title: string | null (the cascade root)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Key dependency chain:**
- `effect@^3.15.0` — Option, Effect, Either, pipe
- `zustand@^5.0.2` — state management with persist middleware
- `@supabase/supabase-js@^2.47.10` — DB client returning `{ data: T | null, error }`
- `ai@^4.0.0` (Vercel AI SDK) — chat streaming
- `reactflow@^11.11.4` — canvas (has its own `| null` in edge types)

---

## 3. Null Audit — Production Code (48 occurrences)

### By Category

| Category | Count | Migratable? |
|----------|:-----:|:-----------:|
| `useRef<T>(null)` — React DOM refs | 14 | ❌ React requires this |
| `Option.match → null` — JSX "render nothing" | 10 | ⚠️ Optional (could use `&&`) |
| Type annotations `\| null` — DB/API boundary types | 11 | ⚠️ Partial — mirrors DB schema |
| `Option.getOrNull` — intentional Option→DB bridge | 3 | ❌ Correct boundary pattern |
| `new NextResponse(null, ...)` — HTTP 204 | 2 | ❌ Next.js API requirement |
| `return null` — JSX conditional render | 2 | ⚠️ Optional |
| `!== null` runtime check | 1 | ✅ Yes |
| Stripe/external SDK types | 1 | ❌ External API |
| ReactFlow callback param `\| null` | 2 | ❌ Library signature |
| JSX ternary `: null` | 1 | ⚠️ Optional |
| `Option.getOrNull → ?? undefined` double-unwrap | 1 | ✅ Yes (use `getOrUndefined`) |

### Root Cause: `Session.title: string | null`

The **single most impactful null** in the codebase is in `lib/types.ts`:

```typescript
export type Session = {
  // ...
  title: string | null;  // ← cascades through 6+ files
};
```

This forces `null` into:
- `api.types.ts` → `CreateSessionBody.title?: string | null`
- `services/sessions.ts` → `Option.getOrNull(titleOpt)` at every DB write
- `services/sessionsClient.ts` → `Option.getOrNull(titleOpt)` at API POST
- `services/handoff.ts` → `Option.getOrNull(titleOpt)` at RPC call
- `lib/session.ts` → `Option.fromNullable(session.title)` bounce

**Recommendation:** Change `Session.title` to `Option<string>` and handle the DB `null` conversion in a single mapper function (`sessionToPublic` / `canvasFromDb`), rather than scattering `getOrNull`/`fromNullable` across every consumer.

---

## 4. Effect Option Usage — What's Working

### ✅ Exemplary Files (Copy These Patterns)

**`lib/userProfile.ts`** — Returns `Option<string>`, consumed via `Option.match`:
```typescript
export function getAvatarUrl(user: User): Option.Option<string> { ... }
export function getDisplayName(user: User): Option.Option<string> { ... }
// Consumed:
Option.match(getAvatarUrl(user), { onNone: () => <Initials/>, onSome: (url) => <Image/> })
```

**`lib/userPreferences.ts`** — `fromNullable` → `flatMap` chain, never unwrapped:
```typescript
export function getNodeLibraryProvider(...): Effect.Effect<Option.Option<NodeLibraryProvider>> {
  return pipe(
    Effect.tryPromise({ ... }),
    Effect.map(({ data }) =>
      pipe(Option.fromNullable(data), Option.flatMap(...), Option.flatMap(parseProviderOption))
    ),
  );
}
```

**`lib/stripe.ts`** — Singleton via `Option.match`, `getPackById` returns `Option`:
```typescript
export function getPackById(packId: string): Option.Option<TokenPack> {
  return Option.fromNullable(TOKEN_PACKS.find((p) => p.id === packId));
}
```

**`stores/sessionStore.ts`** — Clean store, `currentSessionId: Option<string>`.

**`lib/chatGuardrails.ts`** — `Option.match` branches into `Effect.fail`/`Effect.succeed`.

### ✅ Consistent Conventions

- **All 84 files** use barrel imports: `import { Option, Effect, ... } from "effect"`
- **Zero** deep path imports, zero single-character aliases
- **Two-tier `pipe` convention**: services use `pipe()` for Effect composition; components/stores call `Option.*` directly — this is reasonable
- **Test patterns**: `Option.isNone()`/`Option.isSome()` for assertions, `Option.getOrNull()` for value comparisons, `Effect.runPromise(Effect.either(...))` for Effect tests

---

## 5. Anti-Patterns Found

### 🔴 Anti-Pattern 1: Option→Null Round-Trips (HIGH FREQUENCY — ~59 `getOrNull` calls)

The most pervasive problem. Option values are created, then immediately unwrapped back to `null` for an external API:

**In `services/sessions.ts`** (the worst offender):
```typescript
// titleOpt is Option<string>, but it's immediately unwrapped:
const insertRow = { user_id: userId, title: Option.getOrNull(titleOpt) };

// Supabase response is nullable, wrapped in Option, then immediately matched:
Option.match(Option.fromNullable(data), {
  onNone: () => Effect.fail({ message: "No data returned" }),
  onSome: (d) => Effect.succeed(sessionToPublic(d)),
});
```

The Option is never *threaded* — it's created and destroyed in the same expression. This adds ~3 function calls where `data ? succeed(toPublic(data)) : fail(...)` would suffice.

**Affected files:** `services/sessions.ts` (5×), `services/handoff.ts` (2×), `services/sessionsClient.ts` (1×), `stores/canvasStore.ts` (1×), `lib/canvas.ts` (2×), `lib/session.ts` (1×)

### 🔴 Anti-Pattern 2: `getOrNull(x) ?? undefined` Double-Unwrap

```typescript
// canvasStore.ts — getCanvasState():
const viewportValue = Option.getOrNull(viewport);
return replaceCanvasState(
  { nodes, edges, viewport: viewportValue ?? undefined },
  nodes, edges,
  viewportValue ?? undefined
);
```

`Option.getOrNull` returns `T | null`. Then `?? undefined` converts `null → undefined`. Should use `Option.getOrUndefined(viewport)` directly.

**Affected files:** `stores/canvasStore.ts`, `lib/canvas.ts` (`canvasFromDb`)

### 🟡 Anti-Pattern 3: `Option.match` for Imperative No-Ops

Throughout components, `Option.match` is used where only the `onSome` branch does work:

```typescript
Option.match(handoffIdOpt, {
  onNone: () => {},        // ← empty function
  onSome: (handoffId) => { /* actual work */ },
});
```

This pattern appears **~20 times** across `ChatPanel.tsx`, `PostAuthRoot.tsx`, `InterviewSplitView.tsx`, `FlowCanvas.tsx`. A utility like `Option.tap` or a simple `if (Option.isSome(x))` guard would be cleaner.

### 🟡 Anti-Pattern 4: `Option<T>` Refs Instead of `T | null` Refs

```typescript
// FlowCanvas.tsx — debounce timer as Option ref:
const saveTimeoutRef = useRef<Option.Option<ReturnType<typeof setTimeout>>>(Option.none());
// Requires 3 Option.match calls just to manage a timeout!

// InterviewSplitView.tsx — staleness check refs:
const previousSessionIdRef = useRef<Option.Option<string>>(Option.none());
const loadingSessionIdRef = useRef<Option.Option<string>>(Option.none());

// ChatPanel.tsx — handoff done tracker:
const handoffDoneRef = useRef<Option.Option<string>>(Option.none());
// Nested Option.match just to compare a string:
const alreadyHandled = Option.match(handoffDoneRef.current, {
  onNone: () => false,
  onSome: (done) => done === pendingSessionId,
});
```

These refs are never consumed by any Option-aware API — they're private mutable state. Plain `useRef<T | null>(null)` with `=== null` checks would be far simpler. **Option adds value when values flow through multiple functions; mutable refs are consumed in-place.**

### 🟡 Anti-Pattern 5: Nested `Option.match` Instead of `flatMap`/`Option.all`

```typescript
// csrf.ts:
Option.match(requestOrigin, {
  onNone: () => false,
  onSome: (origin) =>
    Option.match(requestHost, {
      onNone: () => false,
      onSome: (host) => new URL(origin).host === host,
    }),
});
```

Could be:
```typescript
pipe(
  Option.all([requestOrigin, requestHost]),
  Option.map(([origin, host]) => new URL(origin).host === host),
  Option.getOrElse(() => false)
);
```

### 🟢 Anti-Pattern 6: Option as Lazy Singleton

```typescript
// stripe.ts:
let _stripeOpt: Option.Option<Stripe> = Option.none();
export function getStripeClient(): Stripe {
  return Option.match(_stripeOpt, { ... });
}
```

This works correctly but is over-engineered — a plain `let _stripe: Stripe | null = null` with `if (!_stripe)` guard is the universal JS pattern for lazy singletons. Low priority.

---

## 6. Boundary Analysis — Where Null Is Unavoidable

These boundaries will **always** need null conversion. The goal is to isolate them into thin adapter functions:

| Boundary | Direction | Current Pattern | Recommendation |
|----------|-----------|-----------------|----------------|
| **Supabase DB read** | `null → Option` | `Option.fromNullable(data)` scattered across services | Centralize in mapper functions (`sessionToPublic`, `canvasFromDb`) |
| **Supabase DB write** | `Option → null` | `Option.getOrNull(titleOpt)` scattered across services | Create `toDbInsert()`/`toDbUpdate()` adapter functions |
| **JSON serialization** (localStorage) | `Option → null → Option` | `partialize` + `merge` in Zustand persist | Already isolated — this is fine |
| **React `useRef`** | Must use `null` | `useRef<T>(null)` | Leave as-is — React requires this |
| **Next.js `NextResponse`** | Must use `null` | `new NextResponse(null, { status: 204 })` | Leave as-is |
| **ReactFlow callbacks** | `\| null` in params | `MouseEvent \| TouchEvent \| null` | Leave as-is — library types |
| **ReactFlow edge handles** | `string \| null` | In `ReactFlowEdge` type | Leave as-is — matches ReactFlow |
| **API JSON bodies** | `Option → null` | `Option.getOrNull` at POST/PUT sites | Isolate into request builder functions |

---

## 7. Recommended Refactoring Plan

### Phase A: Fix the Root Type (HIGH IMPACT)

**Change `Session.title` from `string | null` to `Option<string>`.**

This single change eliminates the cascade of `fromNullable`/`getOrNull` through 6+ files. The conversion to/from DB `null` should happen in exactly two places:

1. `sessionToPublic(db: DbInterviewSession): Session` — wraps `db.title` with `Option.fromNullable`
2. `toSessionInsert(session)` / `toSessionUpdate(fields)` — unwraps with `Option.getOrNull`

```typescript
// lib/types.ts — AFTER:
export type Session = {
  id: string;
  userId: string;
  title: Option.Option<string>;  // ← was `string | null`
  status: string;
  isTrial: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Similarly, change `api.types.ts`:
```typescript
export type CreateSessionBody = { title?: string | null };
// → Keep as-is for the wire format. The conversion happens in sessionsClient.ts.
```

### Phase B: Centralize Supabase Null Adapters

Create a thin adapter layer in `services/sessions.ts`:

```typescript
// Supabase response → domain type (null → Option)
function sessionFromDb(db: DbInterviewSession): Session {
  return { ...sessionToPublic(db) };  // already wraps title
}

// Domain type → Supabase insert (Option → null)
function toInsertRow(userId: string, titleOpt: Option.Option<string>): DbInterviewSessionInsert {
  return { user_id: userId, title: Option.getOrNull(titleOpt) };
}

// Replace inline Option.fromNullable(data) with a simple ternary:
Effect.flatMap(({ data, error }) =>
  error
    ? Effect.fail(toSessionError(error))
    : data
      ? Effect.succeed(sessionFromDb(data as DbInterviewSession))
      : Effect.fail({ message: "No data returned" })
);
```

This replaces `Option.match(Option.fromNullable(data), ...)` with a simple ternary — no Option allocation for values that are immediately consumed.

### Phase C: Replace `getOrNull → ?? undefined` with `getOrUndefined`

A mechanical find-and-replace across 2 files:

| File | Current | Fix |
|------|---------|-----|
| `stores/canvasStore.ts` (`getCanvasState`) | `Option.getOrNull(viewport) ?? undefined` | `Option.getOrUndefined(viewport)` |
| `lib/canvas.ts` (`canvasFromDb`) | `Option.getOrNull(parseViewport(...)) ?? undefined` | `Option.getOrUndefined(parseViewport(...))` |

### Phase D: Replace `Option<T>` Refs with Plain Nullable Refs

In components where refs hold `Option` but are never passed to Option-aware APIs:

| File | Ref | Change |
|------|-----|--------|
| `FlowCanvas.tsx` | `saveTimeoutRef: Option<ReturnType<typeof setTimeout>>` | `useRef<ReturnType<typeof setTimeout> \| null>(null)` |
| `InterviewSplitView.tsx` | `previousSessionIdRef: Option<string>` | `useRef<string \| null>(null)` |
| `InterviewSplitView.tsx` | `loadingSessionIdRef: Option<string>` | `useRef<string \| null>(null)` |
| `ChatPanel.tsx` | `handoffDoneRef: Option<string>` | `useRef<string \| null>(null)` |

### Phase E: Add a `whenSome` Utility for Imperative Side-Effects

The `Option.match({ onNone: () => {}, onSome: ... })` pattern appears ~20 times. Add:

```typescript
// lib/optionHelpers.ts
import { Option } from "effect";

/** Run a side-effect only when the Option is Some. */
export function whenSome<T>(opt: Option.Option<T>, fn: (value: T) => void): void {
  if (Option.isSome(opt)) fn(opt.value);
}
```

Then replace:
```typescript
// Before:
Option.match(handoffIdOpt, { onNone: () => {}, onSome: (id) => doWork(id) });
// After:
whenSome(handoffIdOpt, (id) => doWork(id));
```

### Phase F: Flatten Nested `Option.match` with `Option.all`

In `csrf.ts`:
```typescript
// Before:
Option.match(requestOrigin, {
  onNone: () => false,
  onSome: (origin) => Option.match(requestHost, { ... }),
});

// After:
pipe(
  Option.all([requestOrigin, requestHost]),
  Option.map(([origin, host]) => {
    try { return new URL(origin).host === host; }
    catch { return false; }
  }),
  Option.getOrElse(() => false)
);
```

### Phase G: JSX Null Returns — Low Priority, Optional

The 10 `Option.match → null` JSX patterns are idiomatic React. Optionally replace with:

```typescript
// Before:
{Option.match(evaluateActionOpt, {
  onNone: () => null,
  onSome: (action) => <Button ... />,
})}

// After:
{Option.isSome(evaluateActionOpt) && <Button ... evaluateActionOpt.value ... />}
```

This is purely a style choice. Both are correct.

---

## 8. Architectural Risks

### Risk 1: Supabase Type Generation Resets Nulls
`database.types.ts` is auto-generated via `npx supabase gen types`. Every regeneration brings back `| null` for nullable columns. The adapter layer (Phase B) must be robust enough to absorb this.

### Risk 2: Zustand Persist Middleware Strips Option
Zustand's `persist` middleware serializes to JSON. `Option.some("foo")` becomes `{"_tag":"Some","value":"foo"}` in localStorage — which is fragile. The current `partialize` + `merge` pattern correctly handles this by converting to/from null at the boundary. **Do not remove this.**

### Risk 3: API Wire Format Expectations
The Next.js API routes return plain JSON with `null` for missing values (e.g., `{ title: null }`). Client code (`sessionsClient.ts`) receives this and must convert. If `Session.title` becomes `Option<string>`, the JSON deserializer needs a mapping step. Consider a `parseSession(json: unknown): Session` function.

### Risk 4: ReactFlow Type Compatibility
`ReactFlowEdge.sourceHandle` and `targetHandle` are `string | null` by ReactFlow's own types. These cannot be changed to Option without a wrapper layer around every ReactFlow callback.

### Risk 5: Effect Version Drift
The codebase uses `effect@^3.15.0` with only `Option`, `Effect`, `Either`, and `pipe`. Zero usage of `Schema`, `Layer`, `Context`, `Stream`. If the team adopts more Effect modules later, the current approach (imperative `Effect.runPromise` at the call-site) may need restructuring to support proper dependency injection.

---

## 9. Priority Matrix

| Priority | Task | Impact | Effort | Files |
|:--------:|------|:------:|:------:|:-----:|
| 🔴 P0 | Fix `getOrNull → ?? undefined` double-unwrap | Low risk, high clarity | XS | 2 |
| 🔴 P0 | Add `whenSome` utility, replace no-op matches | Medium clarity | S | ~10 |
| 🟡 P1 | Change `Session.title` to `Option<string>` | HIGH — eliminates cascade | M | ~8 |
| 🟡 P1 | Centralize Supabase null adapters | HIGH — reduces service noise | M | 3 |
| 🟡 P1 | Revert `Option` refs to `T \| null` in components | Medium clarity | S | 4 |
| 🟢 P2 | Flatten nested `Option.match` in `csrf.ts` | Low | XS | 1 |
| 🟢 P2 | JSX null return cleanup | Style only | S | ~5 |
| 🟢 P2 | Add `parseSession` for API wire format | Risk reduction | S | 2 |

---

## 10. Guiding Principles for Future Option Usage

1. **Option is for *domain semantics*, not null-avoidance ceremony.** Use it when "absence" has meaning (no active session, no title, no avatar). Don't wrap values that are immediately unwrapped.

2. **Boundaries convert, interiors compose.** Wrap `null` → `Option` at the earliest read point (DB mapper, API parser). Unwrap `Option` → `null` at the latest write point (DB insert, JSON response). Everything in between should stay as `Option`.

3. **Don't use Option for mutable refs.** React refs are local mutable state consumed in-place. `useRef<T | null>(null)` is idiomatic and correct.

4. **`Option.match` is for branching, not side-effects.** If only `onSome` does work, use `whenSome(opt, fn)` or `if (Option.isSome(opt))`.

5. **`getOrNull` means "I'm crossing a boundary."** It should only appear in: DB insert/update functions, JSON serialization, and localStorage persistence. If you see it elsewhere, the Option isn't being threaded far enough.

6. **Prefer `getOrUndefined` over `getOrNull ?? undefined`.** The double-conversion is a code smell.

7. **`Option.all` and `Option.flatMap` over nested `Option.match`.** Flatten the pyramid.
