# Implementation Plan — Architecture Review Fixes
*Created: 2026-02-26*
*Source: `docs/architecture-review-2026-02-26.md`*

31 findings grouped into **10 atomic commits**, ordered by dependency and priority.
Each commit is independently shippable (tests pass, no half-done refactors).

---

## ✅ Commit 1 — `fix: prevent toSessionUpdateDbFields from NULLing absent columns`
**Findings:** 5.1
**Risk:** P1 — active data corruption in production
**Status:** Done — committed as `672ce69`
**Files changed:**

| File | Change |
|------|--------|
| `services/sessions.ts` | Make both `titleOpt` and `statusOpt` optional on `SessionUpdateFields`. Build the update object conditionally — only include a key when its corresponding option is provided. |
| `services/sessions.test.ts` | Add test: rename-only call must NOT include `status` key. Add test: terminate-only call must NOT include `title` key. |
| `app/api/sessions/[id]/route.ts` | No change needed — already passes only `titleOpt`. |
| `app/api/chat/route.ts` | No change needed — already passes both `titleOpt` and `statusOpt`. |

**How to verify:**
```bash
pnpm vitest run services/sessions.test
```

---

## ✅ Commit 2 — `fix: stop fitView from overriding saved viewport on mount`
**Findings:** 1.1
**Risk:** P1 — user-visible viewport loss on every session load
**Status:** Done — committed as `9e76fd4`
**Files changed:**

| File | Change |
|------|--------|
| `components/canvas/FlowCanvas.tsx` | Remove the `fitView` and `fitViewOptions` props from `<ReactFlow>`. Add a `useEffect` that calls `reactFlowInstance.fitView({ padding: 0.2, maxZoom: 1.5 })` **only** when `viewport` is `Option.none()` (no saved viewport). When `viewport` is `Option.some(…)`, `defaultViewport` already handles it. |
| `e2e/anonymous-canvas.spec.ts` | Add assertion: after drop + refresh, the viewport zoom/position should match what was saved (not re-fitted). |

**How to verify:**
```bash
pnpm vitest run --reporter=verbose 2>&1 | head -40   # unit
pnpm exec playwright test e2e/anonymous-canvas.spec.ts  # e2e
```

---

## ✅ Commit 3 — `fix: replace in-memory rate limiter with Supabase`
**Findings:** 1.2, 2.2
**Risk:** P1 — rate limiting is non-functional in serverless
**Status:** Done — committed as `72b445b`
**Files changed:**

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_rate_limit_buckets.sql` | Create `rate_limit_buckets` table: `(key TEXT PRIMARY KEY, count INT NOT NULL, reset_at TIMESTAMPTZ NOT NULL)`. Add RPC `check_rate_limit(p_key TEXT, p_window_ms INT, p_max INT) → JSONB` that atomically upserts and returns `{ allowed, remaining, reset_at }`. |
| `lib/rateLimit.ts` | Replace in-memory `Map` with an Effect that calls `supabase.rpc("check_rate_limit", …)`. Keep the same `checkRateLimit` signature (add `client` param). Delete `API_RATE_LIMIT` (finding 2.2 — unused) or keep it if we now apply it. Delete `resetRateLimitStore`. |
| `lib/rateLimit.test.ts` | Rewrite tests to mock the Supabase RPC instead of relying on in-memory state. |
| `app/api/chat/route.ts` | Pass the Supabase client to `checkRateLimit`. |

**How to verify:**
```bash
pnpm vitest run lib/rateLimit.test
supabase db reset && supabase test db   # migration + RPC test
```

---

## ✅ Commit 4 — `fix: use NEXT_PUBLIC_SITE_URL as checkout origin fallback`
**Findings:** 5.2
**Risk:** P2 — broken Stripe redirect in production
**Status:** Done — committed as `52a19f4`
**Files changed:**

| File | Change |
|------|--------|
| `app/api/checkout/route.ts` | Replace `request.headers.get("origin") ?? "http://localhost:3000"` with `request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? (() => { throw … })()`. Return 500 if neither is available. |
| `app/api/checkout/route.test.ts` | Add test: when origin header is missing, falls back to env var. Add test: when both missing, returns 500. |

**How to verify:**
```bash
pnpm vitest run app/api/checkout
```

---

## ✅ Commit 5 — `refactor: consolidate NodeLibraryProvider validation & schema duplication`
**Findings:** 7.1, 3.1, 3.2
**Risk:** P2 — three separate sources of truth for the same enum; two separate sources of truth for API schemas
**Status:** Done — committed as `666c889`
**Files changed:**

| File | Change |
|------|--------|
| `lib/api.schemas.ts` | Add `NodeLibraryProviderSchema = z.enum(["all", "aws", "gcp", "azure", "generic"])`. Export it. |
| `lib/types.ts` | Derive `NodeLibraryProvider` from `z.infer<typeof NodeLibraryProviderSchema>` (import the schema). Remove the hand-written union. |
| `lib/userPreferences.ts` | Delete `VALID_PROVIDERS` array. Import `NodeLibraryProviderSchema` and use `.safeParse()` in `parseProviderOption`. |
| `app/api/preferences/route.ts` | Delete local `NodeLibraryProviderSchema`. Import from `lib/api.schemas.ts`. |
| `components/canvas/NodeLibrary.tsx` | Delete inline `parseProviderFromUrl` type-guard. Import `NodeLibraryProviderSchema` and use `.safeParse()`. |
| `lib/api.types.ts` | **Delete the file entirely.** |
| `services/sessionsClient.ts` | Replace `import … from "@/lib/api.types"` with imports from `@/lib/api.schemas`. Define a local `ApiErrorResponse` type (it's trivial: `{ error?: string }`). |
| `app/api/chat/route.ts` | Replace `parseChatBody` + `validateChatBoundaries` with `ChatBodySchema.safeParse(raw)`. Keep `extractContent` (the `data.messages` fallback) as a pre-processing step before `.safeParse`. Delete ~80 lines of hand-written parsing. |
| Tests | Update `lib/api.schemas.test.ts` to cover the new `NodeLibraryProviderSchema`. Update `lib/chatHelpers.test.ts` / `app/api/chat/route.test.ts` if they mock `parseChatBody`. |

**How to verify:**
```bash
pnpm vitest run lib/api.schemas lib/userPreferences app/api/preferences app/api/chat services/sessionsClient
pnpm tsc --noEmit   # full type check
```

---

## ✅ Commit 6 — `refactor: delete dead code (handoff, bootstrap, CSRF, transcript, settings)`
**Findings:** 2.1, 2.3, 2.4, 2.5, 2.6, 4.4, 6.1, 6.2, 6.3
**Status:** Done — committed as `84f21c1`
**Risk:** P2–P4 dead code removal — zero runtime impact
**Files deleted:**

| File | Reason |
|------|--------|
| `hooks/usePostAuthHandoff.ts` | Hook never called (2.3) |
| `hooks/usePostAuthHandoff.test.ts` | Tests for dead hook |
| `lib/csrf.ts` | Never imported outside its test (2.1) |
| `lib/csrf.test.ts` | Tests for dead module |
| `components/billing/BuyTokensButton.tsx` | Never imported (6.2) |
| `app/dashboard/` (directory) | Empty (6.1) |
| `app/interview/[sessionId]/` (directory) | Empty (6.1) |
| `app/api/sessions/[id]/settings/route.ts` | Permanently empty `SessionSettings` CRUD (4.4) |

**Files modified:**

| File | Change |
|------|--------|
| `lib/sessionBootstrap.ts` | Remove `deduct_and_handoff` from `BootstrapAction` union. Remove `deductTokenAndCreateSession` from `BootstrapDeps`. Delete the corresponding `case` in `executeBootstrapAction`. (2.4) |
| `lib/sessionBootstrap.test.ts` | Remove tests for the deleted action. |
| `lib/transcript.ts` | Delete `mergeTranscript` export. (2.5) |
| `lib/transcript.test.ts` | Delete `mergeTranscript` tests. |
| `lib/canvas.ts` | Move `getSampleCanvasState` out. (2.6) |
| `lib/__fixtures__/canvas.ts` | New file — receives `getSampleCanvasState`. |
| `lib/canvas.test.ts` | Update import to `@/lib/__fixtures__/canvas`. |
| `lib/canvasEdge.test.ts` | Update import to `@/lib/__fixtures__/canvas`. |
| `stores/canvasStore.test.ts` | Update import to `@/lib/__fixtures__/canvas`. |
| `lib/userProfile.ts` | Delete `getProviderLabel`. (6.3) |
| `lib/userProfile.test.ts` | Delete `getProviderLabel` tests. |
| `services/sessions.ts` | Delete `getSessionSettings`, `saveSessionSettings`, `sessionSettingsFromDb`, `DEFAULT_SESSION_SETTINGS`. Remove `DbSessionSettings*` imports. (4.4) |
| `services/sessionsClient.ts` | Delete `fetchSessionSettings`, `saveSessionSettingsApi`. Remove `SessionSettings` import from `@/lib/types`. (4.4) |
| `lib/types.ts` | Delete `SessionSettings = Record<string, never>`. (4.4) |

**How to verify:**
```bash
pnpm tsc --noEmit
pnpm vitest run
```

---

## ✅ Commit 7 — `refactor: split loadingSessionIdRef, fix PostAuthRoot rename, getSession`
**Findings:** 4.7, 1.3, 5.3
**Status:** Done — committed as `89a64eb`
**Risk:** P2–P3 — race condition fix + redundant call removal + UX correctness
**Files changed:**

| File | Change |
|------|--------|
| `components/interview/InterviewSplitView.tsx` | Replace single `loadingSessionIdRef` with `loadingCanvasSessionIdRef` and `loadingTranscriptSessionIdRef`. Each effect writes/reads its own ref. Merge the two `import … from "@/stores/canvasStore"` statements (also fixes 4.9). |
| `components/PostAuthRoot.tsx` | Delete the `renameSessionApi(payload.session_id, title)` call after successful handoff (1.3). Replace `supabase.auth.getSession()` with `supabase.auth.getUser()` — adapt the callback to use `data.user` instead of `data.session` (5.3). |

**How to verify:**
```bash
pnpm tsc --noEmit
pnpm vitest run components/
```

---

## ✅ Commit 8 — `refactor: extract apiPatch, add preferencesClient, sidebar persist`
**Findings:** 4.2, 8.1, 8.3
**Status:** Done — committed as `2300b1f`
**Risk:** P3 — code duplication & inconsistency cleanup
**Files changed:**

| File | Change |
|------|--------|
| `services/sessionsClient.ts` | Extract `apiPatch<T>(path, body): Effect<T, ApiError>`. Rewrite `renameSessionApi` and `saveSessionSettingsApi` (if not already deleted in commit 6) to use it. (4.2) |
| `services/preferencesClient.ts` | **New file.** `fetchNodeLibraryProvider()` and `saveNodeLibraryProvider(provider)` wrapping `GET /api/preferences` and `PATCH /api/preferences` using Effect + apiGet/apiPatch. (8.1) |
| `services/preferencesClient.test.ts` | **New file.** Tests for the new client. |
| `components/canvas/NodeLibrary.tsx` | Replace raw `fetch("/api/preferences")` calls with imports from `services/preferencesClient`. (8.1) |
| `stores/sidebarStore.ts` | Replace hand-rolled `getStored`/`setStored`/`hydrate` with Zustand `persist` middleware + `skipHydration: true`. Export `rehydrateSidebarStore()`. Move `import { create }` to the top of the file (also fixes 4.8). (8.3) |
| `components/layout/CollapsibleSidebar.tsx` | Replace `useSidebarStore.getState().hydrate()` with `rehydrateSidebarStore()`. (8.3) |

**How to verify:**
```bash
pnpm vitest run services/preferencesClient stores/sidebarStore
pnpm tsc --noEmit
```

---

## ✅ Commit 9 — `refactor: rename misleading functions, remove dead params`
**Findings:** 4.1, 4.6, 8.4
**Status:** Done — committed as `9b7fc6c`
**Risk:** P3–P4 — naming-only, no logic change
**Files changed:**

| File | Change |
|------|--------|
| `lib/canvas.ts` | Rename `replaceCanvasState` → `makeCanvasState`. Remove `_current` param. (4.1) |
| `stores/canvasStore.ts` | Update call site: `makeCanvasState(nodes, edges, viewportValue)`. (4.1) |
| `lib/canvas.test.ts` | Update test references. (4.1) |
| `services/handoff.ts` | Remove `_userId` parameter from `claimTrialAndCreateSession`. (4.6) |
| `services/handoff.test.ts` | Update call sites in tests. (4.6) |
| `app/api/auth/handoff/route.ts` | Remove `user.id` argument from call to `claimTrialAndCreateSession`. (4.6) |
| `services/tokens.ts` | Rename `getOrCreateStripeCustomerId` → `findStripeCustomerId`. (8.4) |
| `services/tokens.test.ts` | Update references. (8.4) |
| `app/api/checkout/route.ts` | Update import + call. (8.4) |
| `app/api/checkout/route.test.ts` | Update mock name. (8.4) |

**How to verify:**
```bash
pnpm vitest run
pnpm tsc --noEmit
```

---

## ✅ Commit 10 — `chore: minor cleanups (AuthBar, nodeId, Zustand setters, etc.)`
**Findings:** 4.3, 4.5, 8.2, 8.5, 8.6 · **Status:** Done — `fc3a3da`
**Risk:** P4 — cosmetic / hygiene
**Files changed:**

| File | Change |
|------|--------|
| `components/layout/AuthBar.tsx` | Delete the component entirely — it renders `<></>` and wastes a `getUser()` call. (4.3) |
| `components/interview/InterviewSplitView.tsx` | Remove the `<AuthBar>` import and usage. (4.3) |
| `components/canvas/FlowCanvas.tsx` | Replace module-level `nodeIdCounter` + `nextNodeId()` with `crypto.randomUUID()` in the `onDrop` callback. (8.2) |
| `stores/canvasStore.ts` | Simplify setters: `setNodes: (nodes) => set({ nodes })`, `setEdges: (edges) => set({ edges })`, `setViewport: (viewport) => set({ viewport })`. (4.5) |
| `components/billing/NewSessionButton.tsx` | In `handleClick`, use the existing `balanceOpt` state to show the dialog immediately (optimistic), then refresh in the background. Remove the blocking `fetchTokenBalance()` call and the `loading` dialog state on click. (8.5) |
| `components/billing/CheckoutFeedback.tsx` | Move to `app/layout.tsx` so it renders regardless of `PostAuthRoot` rehydration timing. (8.6) |
| `app/layout.tsx` | Import and render `<CheckoutFeedback />` alongside `<Toaster>`. |
| `components/PostAuthRoot.tsx` | Remove `<CheckoutFeedback />` import and usage. |

**How to verify:**
```bash
pnpm vitest run
pnpm tsc --noEmit
pnpm exec playwright test
```

---

## Execution Order & Dependencies

```
Commit 1 (5.1)  ─── independent, ship first (active data corruption)
Commit 2 (1.1)  ─── independent
Commit 3 (1.2)  ─── independent (needs migration)
Commit 4 (5.2)  ─── independent
Commit 5 (7.1, 3.1, 3.2) ─── independent (biggest refactor surface)
Commit 6 (dead code)      ─── depends on Commit 5 (api.types.ts deleted there)
Commit 7 (4.7, 1.3, 5.3) ─── depends on Commit 6 (usePostAuthHandoff deleted there)
Commit 8 (4.2, 8.1, 8.3) ─── depends on Commit 6 (settings CRUD deleted there)
Commit 9 (4.1, 4.6, 8.4) ─── depends on Commits 6 & 8
Commit 10 (cosmetic)      ─── depends on Commits 7 & 8
```

Commits 1–5 have no interdependencies and can be developed in parallel.
Commits 6–10 form a linear chain that should land in order.

---

## Estimated Effort

| Commit | Size | Estimated time |
|--------|------|----------------|
| 1 | XS | ✅ Done |
| 2 | S | ✅ Done |
| 3 | M | ✅ Done |
| 4 | XS | ✅ Done |
| 5 | L | ✅ Done |
| 6 | M | ✅ Done |
| 7 | S | ✅ Done |
| 8 | M | ✅ Done |
| 9 | S | ✅ Done |
| 10 | S | ✅ Done |
| **Total** | | **~5–7 hours** |
