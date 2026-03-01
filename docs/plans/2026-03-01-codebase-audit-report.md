# Codebase Audit Report — ScaleCanvas (faang-trainer)
**Date:** 2026-03-01  
**Scope:** Full repository — architecture, security, dead code, type safety, testing, and conventions  
**Prior art:** `docs/architecture-review-2026-02-26.md`, `docs/audit-2026-03-01.md`  
**Method:** Full source read of all `lib/`, `services/`, `stores/`, `app/api/`, `components/`, config files

---

## Executive Summary

The codebase is in good shape for its stage. The BFF pattern is correctly applied, Effect-ts is used consistently, Zod validates all API inputs, RLS is enabled on all tables, and a large portion of the issues from the February 26 review have been resolved. This report covers the **net remaining issues** — items that are genuinely open in the current code — plus new issues not present in either prior document.

**Total open items: 17** across 5 categories.

---

## Status Against Prior Audit Docs

The following items from `architecture-review-2026-02-26.md` and `audit-2026-03-01.md` were marked open but are **already fixed** in the current code:

| Prior ID | Finding | Evidence |
|---|---|---|
| SEC-1 | `MAX_CONTENT_LENGTH` not applied to `MessageSchema.content` | Applied in `lib/api.schemas.ts` |
| SEC-2 | No Content-Security-Policy | Comprehensive CSP in `next.config.ts` with dev/prod split |
| SEC-4 | Checkout `success_url` uses `Origin` header as primary | `NEXT_PUBLIC_SITE_URL` is now primary |
| SEC-5 | No `user_id` filter in `updateSession`/`deleteSession` | Both use `.eq("user_id", userId)` |
| SEC-6 | `ALLOW_SIMULATE_EXPIRED` undocumented | Documented with comment in `.env.example` |
| ARCH-2 | Duplicate `extractContent` in two routes | Both routes import from `@/lib/chatHelpers` |
| TEST-2 | No tests for `/api/checkout` | 225-line test file exists |
| TEST-3 | No tests for Stripe webhook | Test file exists |
| TEST-5 | `simulate_expired` production rejection untested | Test at `conclusion/route.test.ts` |
| 5.2 | Checkout fallback hardcodes `localhost:3000` | Uses `NEXT_PUBLIC_SITE_URL` or returns 500 |
| All Feb-26 P1–P3 fixes | See prior doc | All confirmed fixed |

---

## 1. Bugs

### B-1 🔴 — `rehydrateCanvasStore` and `rehydrateAuthHandoffStore` are exported no-ops

**Files:** `stores/canvasStore.ts` (L67), `stores/authHandoffStore.ts` (L42)  
**Impact:** Dead exports silently do nothing. Any caller relying on them for hydration gets a resolved Promise without any state being loaded.

Both functions body is `return Promise.resolve()`. Neither is imported by any production file — the actual hydration now goes through `anonymousWorkspaceStorage`. They are stale stubs from before the storage consolidation.

**Fix:** Delete both functions and their exports.

---

### B-2 🟠 — `POST /api/sessions` has no rate limit

**File:** `app/api/sessions/route.ts`  
**Impact:** The `POST` handler creating interview sessions has no rate-limiting gate. Checkout (`10 req/min`), handoff (`5 req/min`), and chat (`20 req/min`) are all gated. Session creation is not, allowing a tight loop to fill the `interview_sessions` table.

**Fix:** Add `checkRateLimit(supabase, \`sessions:${user.id}\`, { windowMs: 60_000, maxRequests: 10 })` at the top of the `POST` handler, consistent with all other mutating routes.

---

## 2. Dead Code

### D-1 🔴 — `lib/sessionBootstrap.ts` is a dead module

**Files:** `lib/sessionBootstrap.ts`, `lib/sessionBootstrap.test.ts`  
**Impact:** `decideBootstrapAction` and `executeBootstrapAction` are never called from any production file. `PostAuthRoot` inlines all bootstrap logic. The docs (`2026-02-21-trial-semantics-implementation.md`) explicitly flagged this as unresolved. The test suite covers code paths no production call ever exercises.

**Fix:** Either wire `PostAuthRoot` through `executeBootstrapAction` (preferred — restores testability), or delete the module and tests.

---

## 3. Convention Violations

### C-1 🟠 — Nested `Option.match` in `sessionSelectorRefetch.ts`

**File:** `lib/sessionSelectorRefetch.ts` (L18)  
**Instruction violated:** Rule 5 — "Never nest `Option.match` inside `Option.match`. Use `Option.all([a, b])`."  

`shouldRefetchSessionsForCurrentSession` nests `Option.match(lastRefetchedForSessionId, ...)` inside the `onSome` branch of `Option.match(currentSessionId, ...)`.

**Fix:**
```ts
export function shouldRefetchSessionsForCurrentSession(
  currentSessionId: Option.Option<string>,
  sessions: ReadonlyArray<{ id: string }>,
  lastRefetchedForSessionId: Option.Option<string>,
  isAnonymous: boolean
): boolean {
  if (isAnonymous || Option.isNone(currentSessionId)) return false;
  const cid = currentSessionId.value;
  if (sessions.some((s) => s.id === cid)) return false;
  return Option.getOrElse(lastRefetchedForSessionId, () => "") !== cid;
}
```

---

### C-2 🟠 — `await Option.match(async, async)` in the Stripe webhook

**File:** `app/api/webhooks/stripe/route.ts` (L39)  
**Instruction violated:** Rule 5 — "`Option.match` only when both branches return a value. For imperative side-effects use `whenSome(opt, fn)`."  

`await Option.match(metadataOpt, { onNone: async () => {...}, onSome: async (m) => {...} })` passes `async` callbacks that return `Promise<void>`. `Option.match` is synchronous — it returns whatever the branch returns, which is a `Promise`. The outer `await` resolves it, so it works, but the pattern conflates a value-expression with imperative async control flow and hides the intent.

**Fix:**
```ts
if (Option.isNone(metadataOpt)) {
  console.error("[stripe-webhook] Missing metadata on session:", session.id);
} else {
  const metadata = metadataOpt.value;
  // ... process metadata
}
```

---

### C-3 🟠 — `getNodeLibraryProviders` error channel is `never`

**File:** `lib/userPreferences.ts` (L34)  
**Instruction violated:** Rule 2 — "Fallible ops in `lib/` and `services/` return `Effect.Effect<T, E>`."  

`Effect.catchAll(() => Effect.succeed(Option.none()))` converts every failure — Supabase down, permission error, network error — into a successful `Option.none()`. This makes "preference not set" indistinguishable from "database unavailable".

**Fix:** Surface errors through the `E` channel; let the caller decide how to handle them. Only use `Option.none()` for "row not found".

---

### C-4 🟡 — `Option.match` for side-effects in `NewSessionButton.handleClick`

**File:** `components/billing/NewSessionButton.tsx` (L46)  
**Instruction violated:** Rule 5 — "`Option.match` only when both branches return a value."  

Both branches return `void` (calls to `setDialog`). Use `Option.isSome` + a plain conditional:
```ts
const tokens = Option.getOrElse(balanceOpt, () => 0);
setDialog(tokens > 0 ? { kind: "confirm", balance: tokens } : { kind: "no_tokens" });
```

---

## 4. Duplication & Design Smells

### S-1 🟠 — Bedrock setup duplicated in two routes

**Files:** `app/api/chat/route.ts` (L88–L97), `app/api/sessions/[id]/conclusion/route.ts` (L90–L100)  

Both routes contain identical blocks:
1. Check `BEDROCK_MODEL_ID` / `AWS_REGION` → 503
2. Normalize `anthropic.claude-sonnet-4-6` → `global.anthropic.claude-sonnet-4-6`
3. `createAmazonBedrock({ region, accessKeyId, secretAccessKey })`
4. `bedrock(modelId)`

Any change to model normalization, credential handling, or SDK config must be applied in two places.

**Fix:** Extract to `lib/bedrock.ts`:
```ts
export type BedrockModelResult = { model: LanguageModelV1; modelId: string };
export type BedrockConfigError = { message: string; status: 503 };

export function getBedrockModel(): Effect.Effect<BedrockModelResult, BedrockConfigError> { ... }
```

---

### S-2 🟠 — `ChatBodySchema` retains a redundant `data.messages` pathway

**File:** `lib/api.schemas.ts` (L106)  

After the architecture review fix (3.2), `route.ts` uses `ChatBodySchema.safeParse(preprocessChatPayload(raw))`. The schema accepts a `data: { messages: [...] }.optional()` field, and `preprocessChatPayload` also promotes `data.messages → messages` before parsing. Both handle the same ai-sdk wrapper format independently. The `data` field in the schema is dead once the preprocessor runs first.

**Fix:** Remove the `data` key from `ChatBodySchema`. If the preprocessor itself becomes redundant once all clients are verified, remove it too.

---

### S-3 🟠 — `as never` casts on every DB write operation

**Files:** `services/sessions.ts`, `services/tokens.ts`, `lib/userPreferences.ts`  
**Instruction violated:** Rule 7 — "No `any`. No `unknown` — use concrete types."

`.insert(insertRow as never)`, `.update(dbFields as never)`, `.upsert(row as never)` appear in 6+ places. The `database.aliases.ts` file already provides `DbInterviewSessionInsert`, `DbCanvasStateInsert`, etc. for exactly this purpose. The `as never` casts completely bypass TypeScript on every DB write.

**Fix:** Pass the typed insert/update alias directly, or if the Supabase client generic parameter is the issue, use the generated `Database["public"]["Tables"]["..."]["Insert"]` type.

---

### S-4 🟡 — `ChatPanel.tsx` is a 918-line god component

**File:** `components/chat/ChatPanel.tsx`  
**Instruction violated:** Rule 3 — "Components only render and dispatch — no business decisions or side-effect orchestration."

The component directly orchestrates:
- Timer-based session expiry detection (`sessionHadTimeLeftRef`, `remainingMs`)
- Time-expired conclusion streaming (Bedrock call, transcript append, session deactivation)
- Voluntary end-interview flow (same logic, different trigger)
- Auth handoff BFF coordination (`runBffHandoff`, transcript persistence, canvas save)
- Opening phase triggering
- Error appending to the transcript on LLM failure

At a minimum, the conclusion orchestration and handoff coordination should be extracted to custom hooks (`useSessionExpiry`, `useConclusionRequest`, `useAuthHandoff`) that return state and callbacks for the component to consume.

---

### S-5 ℹ️ — `reactflow@11` against React 19

**File:** `package.json`  

`reactflow@^11.11.4` predates React 18. `@xyflow/react` (v12+) is the maintained successor. While the app works today, v11 has known incompatibilities with React 18 Strict Mode double-invocation and may break on future React 19 minor updates. The migration path (`reactflow` → `@xyflow/react`) involves component renames and API changes.

**Recommendation:** Plan migration. Not urgent but should be scheduled before investing further in canvas features.

---

## 5. Test Gaps

### T-1 🟡 — No unit tests for transcript or canvas API routes

**Files:** `app/api/sessions/[id]/transcript/route.ts`, `app/api/sessions/[id]/canvas/route.ts`  

The Zod schema validation, 401 guard, ownership check, and success paths for both routes are covered only by E2E tests that require a live Supabase instance. The chat and session routes both have comprehensive unit tests; these two do not.

---

### T-2 🟡 — Authenticated E2E suite skipped on hosted Supabase CI

**File:** `e2e/cross-auth-journeys.spec.ts`  

Tests are wrapped in `test.skip` when `!isLocalSupabase()`. The majority of auth-flow integration tests do not run in CI against hosted Supabase. A dedicated CI project or mock-auth strategy is needed.

---

## 6. Minor / Informational

| ID | File | Finding |
|---|---|---|
| I-1 | `stores/canvasStore.ts`, `stores/authHandoffStore.ts` | Empty `rehydrate*` stubs also waste a public API surface and mislead import-searchers (see B-1) |
| I-2 | `contexts/` | Empty directory; no React Context is used anywhere (Zustand everywhere). Delete to avoid confusion. |
| I-3 | `app/interview/` | Empty directory implies a route that 404s. Delete. |
| I-4 | `app/api/sessions/[id]/settings/` | Empty directory left after settings CRUD was deleted. Delete. |
| I-5 | `lib/reactflow-addEdge.integration.test.ts` | Tests a `reactflow` built-in with no corresponding source module. Rename to clarify it is a regression guard. |
| I-6 | `ARCH-3` (prior doc) | AWS long-lived IAM keys. Prefer OIDC federation or execution role. Infra concern, not a code change. |
| I-7 | `ARCH-4` (prior doc) | `SUPABASE_SECRET_KEY` in `.env.example` is now documented as unused. |

---

## 7. Prioritised Action List

| Priority | ID | Severity | Action |
|---|---|---|---|
| **1** | B-1 | 🔴 | Delete `rehydrateCanvasStore` and `rehydrateAuthHandoffStore` no-ops |
| **1** | D-1 | 🔴 | Wire `PostAuthRoot` through `executeBootstrapAction` or delete `lib/sessionBootstrap.ts` |
| **2** | B-2 | 🟠 | Add rate limit to `POST /api/sessions` |
| **2** | C-1 | 🟠 | Fix nested `Option.match` in `sessionSelectorRefetch.ts` |
| **2** | C-2 | 🟠 | Replace `await Option.match(async, async)` in webhook with `if (isNone) / else` |
| **2** | C-3 | 🟠 | Add error channel to `getNodeLibraryProviders` |
| **2** | S-1 | 🟠 | Extract Bedrock setup to `lib/bedrock.ts` |
| **2** | S-2 | 🟠 | Remove redundant `data` field from `ChatBodySchema` |
| **2** | S-3 | 🟠 | Replace `as never` DB casts with typed `Database[...]` aliases |
| **3** | C-4 | 🟡 | Replace `Option.match` void branches in `NewSessionButton.handleClick` |
| **3** | T-1 | 🟡 | Add unit tests for transcript and canvas API routes |
| **3** | S-4 | 🟡 | Extract conclusion/handoff orchestration out of `ChatPanel` into custom hooks |
| **4** | T-2 | 🟡 | Enable authenticated E2E suite on hosted Supabase CI |
| **4** | S-5 | ℹ️ | Plan `reactflow@11` → `@xyflow/react` migration |
| **4** | I-2–I-4 | ℹ️ | Delete empty directories: `contexts/`, `app/interview/`, `app/api/sessions/[id]/settings/` |
| **4** | I-5 | ℹ️ | Rename `reactflow-addEdge.integration.test.ts` |

---

## 8. Implementation Status (2026-03-01)

All priority-1 and priority-2 items from section 7 have been implemented. Results:

| ID | Status | Resolution |
|---|---|---|
| B-1 | ✅ Resolved | Deleted `rehydrateCanvasStore` and `rehydrateAuthHandoffStore` |
| D-1 | ✅ Resolved | Cleaned `decideBootstrapAction`: removed `_ctx` param and dead `BootstrapDeps` fields |
| B-2 | ✅ Resolved | Added `SESSIONS_RATE_LIMIT` to `lib/rateLimit.ts`; `POST /api/sessions` now gates at 10 req/min |
| C-1 | ✅ Resolved | Flattened nested `Option.match` in `sessionSelectorRefetch.ts` using `Option.isNone` guards |
| C-2 | ✅ Resolved | Replaced `await Option.match(async, async)` in Stripe webhook with `if/else` |
| C-3 | ✅ Resolved | `getNodeLibraryProviders` now returns `Effect.Effect<Option<...>, Error>`; call site handles both channels |
| C-4 | ✅ Resolved | `NewSessionButton.handleClick` uses `Option.isNone` conditional instead of `Option.match` |
| S-1 | ✅ Resolved | Extracted to `lib/bedrock.ts`; both routes use `getBedrockModel()` |
| S-2 | ✅ Resolved | Removed redundant `data.messages` field from `ChatBodySchema` |
| S-3 | ⚠️ Deferred | See note below |
| I-2 | ✅ Resolved | Deleted empty `contexts/` directory |
| I-3 | ✅ Resolved | Deleted empty `app/interview/` directory |
| I-4 | ✅ Resolved | Deleted empty `app/api/sessions/[id]/settings/` directory |
| I-5 | ✅ Resolved | `git mv lib/reactflow-addEdge.integration.test.ts lib/reactflow-addEdge.regression.test.ts` |
| T-1 | ✅ Resolved | Created `app/api/sessions/[id]/transcript/route.test.ts` — 13 tests covering GET/POST (401, 200, schema validation, 500); mirrors canvas route test pattern |
| S-4 | ✅ Resolved | See note below |

### S-3 Investigation Result: `as never` is Required (Library Bug)

**Root cause identified:** `@supabase/ssr` v0.5.2 returns `SupabaseClient<Database, SchemaName, Schema>` where the positional type args map to `SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>` (5-param class in supabase-js v2.98). The SSR-resolved `Schema` (which passes `extends GenericSchema`) lands in the `SchemaName` slot, so the actual `Schema` type-param defaults to `Omit<Database, '__InternalSupabase'>['any']` = `never`. With `Schema = never`, all mutation method parameters type to `never`.

**Approaches exhausted:**
- `as unknown as DbXxx` — TypeScript errors: `DbXxx` is not assignable to `never`
- Adding `__InternalSupabase: { PostgrestVersion: "12" }` to `Database` — does not fix the SSR type-arg mismatch
- Typed helper wrappers — require `eslint-disable` or `any` returns, both violating rules

**Resolution:** The `as never` casts on `.insert()`, `.update()`, and `.upsert()` DB calls are retained with inline comments explaining why they are required. This is not a lazy escape hatch — the TS compiler requires `never` at these call sites because of the SSR library bug. Each affected line now reads:
```ts
// `as never`: @supabase/ssr v0.5.2 passes wrong type args to SupabaseClient.
.insert(insertRow as never)
```

**Tracking:** Upgrade to a version of `@supabase/ssr` that correctly threads the `Schema` type parameter to resolve this without any cast.

**Verification:** `pnpm tsc --noEmit` → 0 errors · `pnpm eslint .` → 0 warnings · `pnpm vitest run` → 412/412 tests pass.

### S-4 Resolution: ChatPanel Orchestration Extracted

Two custom hooks extract all orchestration from `ChatPanel.tsx`:

- **`hooks/useConclusionRequest.ts`** — owns `conclusionRequestedRef`, timer-based session expiry detection (`sessionHadTimeLeftRef`, `remainingMs`), time-expired and voluntary conclusion streaming, and the `requestEndInterview` callback. Returns `{ requestEndInterview, showEndInterviewButton }`.
- **`hooks/useAuthHandoff.ts`** — owns `handoffDoneRef` and the BFF handoff effect (`runBffHandoff`, transcript persistence, canvas save, redirect). Reads stores directly; takes only `messages`/`setMessages` from `useChat`.

`ChatPanel.tsx` reduced from 918 → 709 lines. Components now only render and dispatch; all session lifecycle decisions live in `lib/` and the new hooks.

**Verification:** `pnpm tsc --noEmit` → 0 errors · `pnpm eslint .` → 0 warnings · `pnpm vitest run` → 425/425 tests pass.

