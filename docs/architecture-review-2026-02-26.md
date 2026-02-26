# Architecture Review — faang-trainer (ScaleCanvas)
*Date: 2026-02-26*

---

## Executive Summary

The codebase is well-structured for an early-stage product. It follows a clear functional-core / effectful-shell split (Effect-ts, Zod, Zustand), has good unit-test coverage of pure logic, and separation between server-side services and client-side API clients is consistent. However, a refactor of the anonymous-handoff flow has left behind several dead modules, type-duplication issues, one functional bug with user-visible impact (viewport loss), one serious infrastructure bug (in-memory rate limiting), a data-corruption bug that silently NULLs session status on every rename, and a security gap where auth checks rely on potentially stale cached sessions.

Total findings: **31** across 8 categories.

---

## 1. Bugs

### 1.1 Saved viewport is discarded on every canvas mount *(High)*
**File:** `components/canvas/FlowCanvas.tsx`

`<ReactFlow fitView fitViewOptions={…}>` is hardcoded. ReactFlow's `fitView` prop re-fits all nodes on mount regardless of `defaultViewport`, so the viewport a user had (pan/zoom) is silently ignored every time they navigate to a session. The stored `viewport` in Zustand and Supabase is populated correctly but never applied.

**Fix:** Remove `fitView` / `fitViewOptions`. Apply the saved viewport only when one exists; fall back to a centered fit (via `reactFlowInstance.fitView()`) when viewport is absent.

---

### 1.2 In-memory rate limiter is per-instance and resets on cold starts *(High)*
**File:** `lib/rateLimit.ts`

The rate-limit store is a module-level `Map`. In a serverless environment (Next.js App Router on Vercel / AWS Lambda), every cold start allocates a fresh module, making the 20 req/min chat limit only enforceable within a single warm function instance. Under real load, a user can trivially exceed limits by triggering multiple cold starts simultaneously.

**Fix:** Replace with a persistent, atomic store. Supabase already present — a `rate_limit_buckets` table with `update … returning` is sufficient. Alternatively, use Vercel KV.

---

### 1.3 Redundant session rename after handoff *(Low)*
**File:** `components/PostAuthRoot.tsx`

After `postHandoff()` succeeds, the component calls `renameSessionApi(payload.session_id, title)`. The BFF route `/api/auth/handoff` already passes `question_title` to the `claim_trial_and_create_session` RPC, which creates the session with that title. The rename fires unconditionally and performs a redundant PATCH round-trip.

**Fix:** Remove the `renameSessionApi` call from `PostAuthRoot.tsx` and ensure the RPC reliably persists the title (it already does).

---

## 2. Dead Code

### 2.1 `lib/csrf.ts` — module exists but is never imported *(Medium)*
**Files:** `lib/csrf.ts`, `middleware.ts`

`lib/csrf.ts` exports `isValidOrigin` and `isMutationMethod`. `middleware.ts` re-implements equivalent logic with `originMatchesHost`, `MUTATION_METHODS`, and `requiresOriginCheck` — all private, all untested beyond the middleware unit tests. Two independent implementations of the same CSRF check will inevitably diverge.

**Fix:** Delete `lib/csrf.ts` and its test, OR make `middleware.ts` import from it. The module-level helpers in middleware are the right abstraction.

---

### 2.2 `API_RATE_LIMIT` export is unused *(Low)*
**File:** `lib/rateLimit.ts`

`API_RATE_LIMIT` is exported but no route imports it. Only `CHAT_RATE_LIMIT` is used.

**Fix:** Either apply `API_RATE_LIMIT` to the remaining mutation routes, or remove the export until it is needed.

---

### 2.3 `hooks/usePostAuthHandoff.ts` — the hook is never called *(Medium)*
**Files:** `hooks/usePostAuthHandoff.ts`

`usePostAuthHandoff()` is exported but has zero usages in any component. The `PostAuthRoot` refactor absorbed its responsibilities directly. Only `runPostAuthHandoff` (the pure helper) is exercised by tests, but even that tests a code path that is no longer invoked.

**Fix:** Delete the file. Move `runPostAuthHandoff` tests into `PostAuthRoot` integration tests if the logic is still worth testing.

---

### 2.4 `lib/sessionBootstrap.ts` — `deduct_and_handoff` action is unreachable *(Medium)*
**Files:** `lib/sessionBootstrap.ts`, `lib/sessionBootstrap.test.ts`

The `BootstrapAction` union includes `deduct_and_handoff` and `BootstrapDeps` requires `deductTokenAndCreateSession`. `PostAuthRoot` no longer calls `executeBootstrapAction` at all — it calls `postHandoff()` directly instead. The bootstrap module and its tests cover a code path that is never exercised from production.

This was explicitly flagged as a known issue in `docs/plans/2026-02-21-trial-semantics-implementation.md` and never resolved.

**Fix:** Remove `deduct_and_handoff` from `BootstrapAction`, remove `deductTokenAndCreateSession` from `BootstrapDeps`, and update `sessionBootstrap.test.ts`. Decide whether to wire `PostAuthRoot` back through `executeBootstrapAction` (preferred for testability) or delete the bootstrap abstraction.

---

### 2.5 `mergeTranscript` in `lib/transcript.ts` is unused *(Low)*
**File:** `lib/transcript.ts`

`mergeTranscript` is exported and tested but never imported outside tests. The transcript store uses `appendEntry`, which inline-spreads instead.

**Fix:** Delete the export and its test, or inline the trivial `[...prev, next]` pattern as a documented store primitive.

---

### 2.6 `getSampleCanvasState` is test fixture code in a production module *(Low)*
**File:** `lib/canvas.ts`

`getSampleCanvasState` is only imported from `*.test.ts` files. Sample data bundled into production library code wastes bytes and obscures the file's purpose.

**Fix:** Move to a `lib/__fixtures__/canvas.ts` or `lib/canvas.testUtils.ts` file with a `*.test.ts` glob exclusion.

---

## 3. Type / Schema Duplication

### 3.1 `lib/api.types.ts` duplicates `lib/api.schemas.ts` *(Medium)*
`lib/api.types.ts` hand-writes `CreateSessionBody` and `AppendTranscriptBody`. `lib/api.schemas.ts` infers identical types from Zod with `z.infer<…>`. `api.types.ts` is imported only by `services/sessionsClient.ts`.

**Fix:** Delete `lib/api.types.ts`. Update `sessionsClient.ts` to import `SessionApiPostBody` from `lib/api.schemas.ts` (or narrow it to the relevant union there).

---

### 3.2 `ChatBodySchema` is defined but the chat route ignores it *(Medium)*
**Files:** `lib/api.schemas.ts`, `app/api/chat/route.ts`

`ChatBodySchema` is a full Zod schema for chat requests with tests, but `route.ts` uses its own hand-written `parseChatBody` + `validateChatBoundaries`. Both parse the same payload independently, so field rules can silently diverge. For example, `parseChatBody` handles the `data.messages` fallback; `ChatBodySchema` does too — but neither references the other.

**Fix:** Make `route.ts` parse the body with `ChatBodySchema.safeParse(raw)` and delete `parseChatBody` / `validateChatBoundaries`. Remove the `data.messages` fallback from the schema if it is no longer needed by any client.

---

## 4. Design Smells

### 4.1 `replaceCanvasState` has a dead first parameter *(Low)*
**File:** `lib/canvas.ts`

```ts
export function replaceCanvasState(_current: CanvasState, nodes, edges, viewport?)
```

`_current` is never read. The function is semantically a `CanvasState` constructor. The misleading parameter implies the current state is consulted for immutability, but nothing of the sort happens.

**Fix:** Remove `_current` and rename to `makeCanvasState` to match its true purpose.

---

### 4.2 Missing `apiPatch` helper leads to copy-pasted fetch chains *(Medium)*
**File:** `services/sessionsClient.ts`

`apiGet`, `apiPost`, `apiPut`, and `apiDelete` are shared helpers, but `renameSessionApi` and `saveSessionSettingsApi` each inline the full 40-line fetch + error-handling chain for PATCH. This is the only method with duplicated boilerplate in the file.

**Fix:** Extract `apiPatch<T>(path, body): Effect<T, ApiError>` and replace both inline implementations.

---

### 4.3 `AuthBar` always renders `<></>` but still fetches user data *(Low)*
**File:** `components/layout/AuthBar.tsx`

The component calls `supabase.auth.getUser()` on mount and stores the result in state, then renders an empty fragment regardless. The comment acknowledges the signed-in UI is elsewhere. This is a fetch with no consumer.

**Fix:** Delete `AuthBar`, remove the import from `InterviewSplitView.tsx`, and inline whatever placeholder is actually needed there.

---

### 4.4 `SessionSettings = Record<string, never>` backed by full CRUD infrastructure *(Medium)*
**Files:** `lib/types.ts`, `services/sessions.ts`, `app/api/sessions/[id]/settings/route.ts`, `services/sessionsClient.ts`

The settings type is permanently empty by definition. `saveSessionSettings` ignores its `_settings` argument entirely and writes a hardcoded row. The GET/PATCH routes exist, the client helpers exist, and `fetchSessionSettings` / `saveSessionSettingsApi` are exported — none of it has any effect.

**Fix:** Either complete the feature (define real fields in `SessionSettings`) or delete the routes, service functions, and client helpers until the feature is designed.

---

### 4.5 Zustand setters unnecessarily re-spread the full state *(Low)*
**File:** `stores/canvasStore.ts`

```ts
setNodes: (nodes) => set((state) => ({ nodes, edges: state.edges, viewport: state.viewport })),
```

Zustand's `set` does a shallow merge by default. Explicitly carrying `state.edges` and `state.viewport` creates new object allocations on every call and obscures intent.

**Fix:** Use `set({ nodes })`, `set({ edges })`, `set({ viewport })` directly.

---

### 4.6 `_userId` is an accepted-but-unused parameter in `claimTrialAndCreateSession` *(Low)*
**File:** `services/handoff.ts`

The function takes `_userId: string` but the RPC derives identity from the Supabase session cookie. The underscore prefix signals the smell was noticed but not resolved. It pollutes the public API and misleads callers into thinking user ID is validated there.

**Fix:** Remove the parameter from the signature and all call sites.

---

### 4.7 Shared `loadingSessionIdRef` across two independent effects *(Medium)*
**File:** `components/interview/InterviewSplitView.tsx`

Both the canvas-loading effect and the transcript-loading effect write to the same `loadingSessionIdRef` to guard against stale async results. A rapid session switch can cause one effect's write to race with the other's guard check — e.g. canvas sets the ref to `"session-B"`, transcript sees `"session-B"` and accepts a stale result for `"session-A"`.

**Fix:** Use two separate refs: `loadingCanvasSessionIdRef` and `loadingTranscriptSessionIdRef`.

---

### 4.8 `import` after function declarations in `sidebarStore.ts` *(Low)*
**File:** `stores/sidebarStore.ts`

`import { create } from "zustand"` appears after the `getStored` and `setStored` function definitions. While JavaScript hoisting makes this work at runtime, it violates every linter convention and readability expectation.

**Fix:** Move all imports to the top of the file.

---

### 4.9 Duplicate `import` from same module in `InterviewSplitView.tsx` *(Low)*
**File:** `components/interview/InterviewSplitView.tsx`

`useCanvasStore` and `rehydrateCanvasStore` are imported in two separate statements from `@/stores/canvasStore`. They should be merged into one.

---

## 5. Additional Bugs

### 5.1 `toSessionUpdateDbFields` always includes all fields, NULLing absent ones *(High)*
**File:** `services/sessions.ts`

```ts
function toSessionUpdateDbFields(fields: SessionUpdateFields) {
  return {
    title: Option.getOrNull(fields.titleOpt),
    status: Option.getOrNull(fields.statusOpt ?? Option.none()), // always null when absent
  };
}
```

The function always returns both `title` and `status` keys. PostgREST treats `null`-valued keys in an `update()` as "set column to NULL", so:

- **Rename (PATCH `/api/sessions/[id]`)**: calls with `{ titleOpt: Option.some("...") }` — `statusOpt` is `undefined` → `status: null` is sent → a `"terminated"` session's status is silently cleared.
- **Terminate (chat `terminate_interview` tool)**: calls with `{ titleOpt: Option.none(), statusOpt: Option.some("terminated") }` — `titleOpt` resolves to `null` → the session's title is silently wiped.

Both callers corrupt a different column.

**Fix:** Build the update object conditionally so only provided fields are included:
```ts
function toSessionUpdateDbFields(fields: SessionUpdateFields): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  if (Option.isSome(fields.titleOpt) || fields.titleOpt === undefined ? false : true) {
    // Always include titleOpt since it's required on the type
    result.title = Option.getOrNull(fields.titleOpt);
  }
  if (fields.statusOpt !== undefined) {
    result.status = Option.getOrNull(fields.statusOpt);
  }
  return result;
}
```
Alternatively, make `titleOpt` optional on `SessionUpdateFields` too, mirroring `statusOpt`, and only include each key when provided.

---

### 5.2 Checkout `origin` fallback hardcodes `localhost` *(Medium)*
**File:** `app/api/checkout/route.ts`

```ts
const origin = request.headers.get("origin") ?? "http://localhost:3000";
```

If the `origin` header is absent (possible from server-side calls, some proxies, or non-browser clients), Stripe `success_url` and `cancel_url` will point to `http://localhost:3000` in production. The user will be sent to localhost after payment. The fallback should read from `NEXT_PUBLIC_SITE_URL` or throw a 500.

---

### 5.3 `PostAuthRoot` uses `getSession()` instead of `getUser()` *(Low)*
**Files:** `components/PostAuthRoot.tsx`, `hooks/usePostAuthHandoff.ts`

Both use `supabase.auth.getSession()` to check whether a user is authenticated. The Supabase docs warn that `getSession()` returns the session from localStorage without re-validating the JWT with the server — it can return stale or expired data.

This is **not a security vulnerability**: the actual security-sensitive operations (creating sessions, deducting tokens, claiming trials) all go through server-side API routes that validate with `getUser()`. A stale client-side session would simply cause `PostAuthRoot` to optimistically start the handoff flow, only to have it fail at the API level with a confusing error.

It is a **UX correctness issue**: an expired session could lead the user into a flow that immediately errors out, rather than being redirected to `/login` cleanly.

**Fix:** Replace `getSession()` with `getUser()` in both files (consistent with how every server route already uses it). Note that `usePostAuthHandoff` is itself dead code (finding 2.3), so only `PostAuthRoot` matters in practice.

---

## 6. Additional Dead Code

### 6.1 `app/dashboard/` and `app/interview/[sessionId]/` are empty route directories *(Low)*
**Dirs:** `app/dashboard/`, `app/interview/[sessionId]/`

Both directories exist but contain no files. Next.js ignores empty directories, but they appear in the file tree as if they are routes, suggesting planned features that were never completed or were moved. They should be deleted to avoid confusion.

---

### 6.2 `BuyTokensButton` is never imported in production *(Medium)*
**File:** `components/billing/BuyTokensButton.tsx`

`BuyTokensButton` is a standalone token-purchase component that is never imported by any other file. `NewSessionButton` and `NoSessionPrompt` implement equivalent purchase UIs inline. The component is effectively dead code and also means the token-purchase UI is implemented three times.

**Fix:** Delete `BuyTokensButton.tsx`, or extract a shared `TokenPackList` primitive and use it from `NewSessionButton` and `NoSessionPrompt`.

---

### 6.3 `getProviderLabel` in `lib/userProfile.ts` is unused in production *(Low)*
**File:** `lib/userProfile.ts`

`getProviderLabel` returns `"Google Account"` / `"GitHub Account"` but is only referenced in its test file. No UI component calls it.

**Fix:** Delete the function and its tests, or use it somewhere (e.g. in the account menu in `CollapsibleSidebar`).

---

## 7. Additional Duplication

### 7.1 `NodeLibraryProvider` valid values are validated in three separate places *(Medium)*
**Files:** `components/canvas/NodeLibrary.tsx`, `lib/userPreferences.ts`, `app/api/preferences/route.ts`

- `NodeLibrary.tsx` has an inline type-guard `parseProviderFromUrl` with a hardcoded `if/else` chain
- `lib/userPreferences.ts` has `VALID_PROVIDERS: readonly NodeLibraryProvider[]` with `.includes()`
- `app/api/preferences/route.ts` has a local `z.enum(["all", "aws", "gcp", "azure", "generic"])` definition

All three express the same constraint independently. A new provider value requires three separate edits and the compiler won't catch a mismatch.

**Fix:** Define `NodeLibraryProviderSchema = z.enum([...])` once in `lib/types.ts` or `lib/api.schemas.ts`. Derive `NodeLibraryProvider` from it with `z.infer`. Import and use in all three sites.

---

## 8. Additional Design Smells

### 8.1 `NodeLibrary.tsx` calls `fetch("/api/preferences")` directly *(Medium)*
**File:** `components/canvas/NodeLibrary.tsx`

All other client-to-API communication goes through typed, Effect-wrapped helpers in `services/`. `NodeLibrary` calls `fetch("/api/preferences")` directly with inline `.then()` chains, no error type, and no Effect wrapping. This sidesteps the project's own conventions and hides the call from any future API layer refactors.

**Fix:** Add `fetchNodeLibraryProvider` and `saveNodeLibraryProvider` to a new `services/preferencesClient.ts` (following the same pattern as `sessionsClient.ts`).

---

### 8.2 Module-level mutable `nodeIdCounter` is not safe across remounts *(Low)*
**File:** `components/canvas/FlowCanvas.tsx`

```ts
let nodeIdCounter = 0;
function nextNodeId(): string { ... }
```

This module-level counter persists across React hot reloads, component remounts (React 18 Strict Mode double-invokes effects), and potentially across concurrent renders. Two nodes dropped in rapid succession in different React trees could share a counter. Since the counter is combined with `Date.now()` collisions are unlikely but the pattern is fragile.

**Fix:** Use `crypto.randomUUID()` or `generateId()` from the `ai` package (already imported in `ChatPanel.tsx`).

---

### 8.3 `sidebarStore.ts` hand-rolls localStorage while other stores use `persist` middleware *(Low)*
**File:** `stores/sidebarStore.ts`

The sidebar store manually implements `getStored()`/`setStored()` helpers and a `hydrate()` action, while `canvasStore` and `authHandoffStore` both use Zustand's `persist` middleware with `skipHydration: true`. The manual approach:
- Requires callers to remember to call `hydrate()` after mount (currently done in `CollapsibleSidebar`)
- Silently reads `localStorage` synchronously on the wrong side of SSR if `typeof window === "undefined"` is ever missed
- Is inconsistent with the rest of the codebase

**Fix:** Replace with `persist(…, { name: "scalecanvas-sidebar-open", skipHydration: true })` and call `rehydrateSidebarStore()` once in `CollapsibleSidebar`, matching the pattern in `canvasStore`.

---

### 8.4 `getOrCreateStripeCustomerId` only gets, never creates *(Low)*
**File:** `services/tokens.ts`

The function name implies it will create a Stripe customer if none exists. It does not — it returns `Option.none()` when absent. Creation is done inline in `app/api/checkout/route.ts`. The misleading name causes readers to incorrectly trust that calling the function is sufficient.

**Fix:** Rename to `findStripeCustomerId` to accurately reflect the query-only behaviour.

---

### 8.5 `NewSessionButton` fetches the token balance twice on open *(Low)*
**File:** `components/billing/NewSessionButton.tsx`

On mount, `refreshBalance()` is called to populate the badge counter. When the user clicks "New Session", `handleClick` calls `fetchTokenBalance()` again to decide which dialog variant to show. The fresh fetch on click is justified (prevents race conditions), but it ignores the in-flight state already resolved in `balanceOpt`. At minimum, the UI should show the badge value optimistically rather than going to `loading` state every click.

**Fix:** Pass `balanceOpt` into `handleClick` as initial state; skip the second network call if a balance was recently fetched (e.g. < 30 seconds old), or show the dialog immediately using the cached value with a background refresh.

---

### 8.6 `CheckoutFeedback` depends on `PostAuthRoot` mount timing *(Low)*
**File:** `components/billing/CheckoutFeedback.tsx`, `components/PostAuthRoot.tsx`

`CheckoutFeedback` is only mounted inside `PostAuthRoot`, which renders at `/` for authenticated users. The Stripe `success_url` is `/?checkout=success`. `PostAuthRoot` redirects to `/{sessionId}` for returning users who have sessions.

Note: the original analysis claimed effects could fire out of order (redirect before toast). This is **incorrect** — React guarantees child `useEffect` callbacks fire before parent ones in the same commit, and `router.replace` is async, so the toast *will* fire. Additionally, `<Toaster>` lives in the root layout (`app/layout.tsx`), so Sonner toasts survive client-side navigations. The toast does appear.

The actual concern is minor: the `PostAuthRoot` renders a loading spinner until `storesReady` is `true`. During this loading phase, `CheckoutFeedback` is **not mounted** (it's in the post-loading JSX branch). If rehydration is slow enough, the URL with `?checkout=success` is visible without the toast appearing until rehydration completes. This is a minor UX timing issue, not a missed toast.

**Fix (optional):** Move `CheckoutFeedback` to the root layout (`app/layout.tsx`) so it renders immediately regardless of store rehydration state.

---

## Prioritised Action List

Total findings: **31** across 8 categories.

| Priority | # | Finding | Action |
|----------|---|---------|--------|
| **P1** | 1.2 | Bug | Replace in-memory rate limiter with a persistent store (Supabase table) |
| ✅ ~~**P1**~~ | ~~5.1~~ | ~~Bug~~ | ~~Fix `toSessionUpdateDbFields` — conditionally include fields to stop NULLing title on terminate and status on rename~~ — **Done** (commit `672ce69`) |
| **P1** | 1.1 | Bug | Fix `fitView` overriding saved viewport on every mount |
| **P3** | 5.3 | UX | Replace `getSession()` with `getUser()` in `PostAuthRoot` (not a security issue — server routes already validate) |
| **P2** | 5.2 | Bug | Replace `"http://localhost:3000"` fallback in checkout with `NEXT_PUBLIC_SITE_URL` |
| **P4** | 8.6 | Smell | Move `CheckoutFeedback` to root layout for immediate rendering (toast is not actually lost) |
| **P2** | 4.7 | Smell | Split shared `loadingSessionIdRef` into canvas and transcript refs |
| **P2** | 3.2 | Duplication | Use `ChatBodySchema` in the chat route; delete hand-written `parseChatBody` |
| **P2** | 7.1 | Duplication | Consolidate `NodeLibraryProvider` validation into a single `z.enum` in `lib/api.schemas.ts` |
| **P2** | 2.4 | Dead code | Remove dead `deduct_and_handoff` from `sessionBootstrap` |
| **P2** | 6.2 | Dead code | Delete unused `BuyTokensButton` or promote it to replace the duplicated inline UIs |
| **P2** | 4.4 | Smell | Delete or complete `SessionSettings` CRUD infrastructure |
| **P2** | 2.3 | Dead code | Delete `usePostAuthHandoff` hook |
| **P3** | 8.1 | Smell | Wrap `NodeLibrary` preferences calls in `services/preferencesClient.ts` |
| **P3** | 8.3 | Smell | Replace hand-rolled localStorage in `sidebarStore` with Zustand `persist` middleware |
| **P3** | 2.1 | Dead code | Consolidate CSRF logic — delete `lib/csrf.ts` or import it from `middleware.ts` |
| **P3** | 3.1 | Duplication | Delete `lib/api.types.ts`; import inferred types from `lib/api.schemas.ts` |
| **P3** | 4.2 | Smell | Extract `apiPatch` helper in `sessionsClient.ts` |
| **P3** | 1.3 | Bug | Remove redundant `renameSessionApi` call after handoff |
| **P3** | 8.4 | Smell | Rename `getOrCreateStripeCustomerId` → `findStripeCustomerId` |
| **P4** | 2.5 | Dead code | Delete `mergeTranscript` export |
| **P4** | 2.2 | Dead code | Apply or delete `API_RATE_LIMIT` |
| **P4** | 2.6 | Dead code | Move `getSampleCanvasState` to test fixtures |
| **P4** | 6.1 | Dead code | Delete empty `app/dashboard/` and `app/interview/[sessionId]/` directories |
| **P4** | 6.3 | Dead code | Delete or use `getProviderLabel` in `lib/userProfile.ts` |
| **P4** | 4.1 | Smell | Rename/fix `replaceCanvasState` → `makeCanvasState`, remove dead `_current` param |
| **P4** | 4.3 | Smell | Delete `AuthBar` or implement the signed-in UI inside it |
| **P4** | 8.2 | Smell | Replace module-level `nodeIdCounter` with `crypto.randomUUID()` |
| **P4** | 8.5 | Smell | Avoid double `fetchTokenBalance` call in `NewSessionButton.handleClick` |
| **P4** | 4.5 | Smell | Simplify Zustand setters in `canvasStore` (remove redundant state re-spread) |
| **P4** | 4.6, 4.8–4.9 | Smell | Minor cleanups: remove `_userId` param, fix import order, merge duplicate imports |

---

## Verification Addendum
*Reviewed: 2026-02-26*

Every finding was verified against the source code. Corrections applied:

| # | Change | Reason |
|---|--------|--------|
| 5.1 | Expanded scope: **bidirectional** data corruption | The `terminate_interview` tool call sets `titleOpt: Option.none()`, which also sends `title: null` — wiping the session title on terminate, not just status on rename. Both directions corrupt data. |
| 5.3 | Downgraded **Medium → Low**, relabelled from "Security" to "UX" | All security-sensitive operations (session creation, token deduction, trial claims) go through server-side routes that validate with `getUser()`. The client-side `getSession()` only gates the UI flow; a stale session leads to a confusing API error, not a security bypass. |
| 8.6 | Downgraded **Medium → Low**, corrected race analysis | The original claim that `router.replace` fires before `CheckoutFeedback`'s `useEffect` is incorrect — React guarantees child effects fire before parent effects in the same commit, and `router.replace` is async. Additionally, `<Toaster>` is in the root layout so Sonner toasts survive client-side navigations. The toast is not actually lost. |
| 8.2 | Noted practical risk is lower than described | There is only one `FlowCanvasInner` mounted at a time. Combined with `Date.now()`, duplicate IDs from the counter are practically impossible. Still worth fixing for hygiene. |
| 8.5 | Clarified the double-fetch is intentional, not accidental | The on-click fetch is a deliberate freshness check (balance could change between mount and click). The smell is showing a loading spinner instead of using the cached value optimistically. |

All other findings (1.1–1.3, 2.1–2.6, 3.1–3.2, 4.1–4.9, 5.2, 6.1–6.3, 7.1, 8.1, 8.3–8.4) verified as **accurate with correct suggested fixes**.
