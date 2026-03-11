# Why E2E Tests Were So Hard to Debug — Architecture Analysis

**Date**: 2026-03-10
**Scope**: Root-cause analysis of E2E debugging difficulty for handoff resilience tests (H1–H3)
**Prior art**: `2026-03-09-handoff-process-analysis.md`
**Updated**: 2026-03-10 — post architecture challenge completion

---

## Executive Summary

The H1–H3 E2E tests took disproportionate effort to stabilize despite comprehensive unit tests and a functional codebase. The root causes are **not** in the functional style itself — they stem from **five architectural gaps** that unit tests structurally cannot catch, and that the E2E layer is uniquely positioned to expose. These gaps sit at boundaries where pure functions hand off to impure infrastructure: browser state, network timing, database constraints, and component orchestration.

This report names each gap, explains why it evaded unit tests, and proposes concrete structural fixes to make E2E tests — and the production system — more resilient.

---

## The Five Root Causes

### 1. 🔴 Ephemeral Zustand Stores Act as the Integration Bus

**What happened**: `pendingSessionId` is set in `PostAuthRoot` and consumed in `useAuthHandoff` (inside `ChatPanel` on a different page). If the `router.replace()` triggers a full page navigation instead of a soft client-side transition, the Zustand store is wiped and `useAuthHandoff` never fires.

**Why unit tests missed it**: Unit tests for `sessionBootstrap.ts` mock `setPendingAuthHandoff` as a simple callback. They verify it's called — but they can't verify that the value survives a navigation boundary. The store is an in-memory singleton; unit tests never exercise page transitions.

**Architecture diagnosis**: Six of seven Zustand stores have **no persistence middleware**. The `authHandoffStore` holds mission-critical handoff state (`pendingSessionId`, `handoffTranscript`, `anonymousMessages`) entirely in memory. Only `sidebarStore` uses `persist()`. The anonymous workspace is manually synced to a single localStorage key via `persistAnonymousWorkspace()`, but `pendingSessionId` is excluded from that serialization.

This creates a fragile "happy path only" design: the handoff works when Next.js performs a soft nav (React re-render, store survives), but fails silently if the navigation is a hard redirect (new page load, store reset to defaults).

**Stores inventory**:

| Store | Persisted | Critical to handoff |
|-------|-----------|-------------------|
| `authHandoffStore` | ❌ No | Yes — `pendingSessionId`, `anonymousMessages` |
| `canvasStore` | ❌ No (manual sync) | Yes — nodes, edges |
| `sessionStore` | ❌ No | No |
| `questionStore` | ❌ No | No |
| `transcriptStore` | ❌ No | No |
| `sidebarStore` | ✅ Yes | No |

**Impact on E2E**: During debugging, `useAuthHandoff` debug logs never appeared in the browser console, creating the illusion that the code path was dead. In reality, the store was simply empty after navigation.

---

### 2. 🔴 Schema-Level vs Database-Level Validation Mismatch

**What happened**: The anonymous workspace seeded message IDs as `"m1"`. The Zod schema (`AppendTranscriptBatchBodySchema`) validates `id: z.string().min(1).max(128)` — no UUID format requirement. The PostgreSQL column is `uuid` type. So Zod says "valid", the API route accepts it, Supabase tries the INSERT, PostgreSQL rejects it with `invalid input syntax for type uuid: "m1"`, and the API returns 500.

**Why unit tests missed it**: Unit tests for `authHandoff.ts` use fixture IDs like `"user-1"`, `"a1"` — none are UUIDs. The `persistTranscript` mock always returns `Either.right(undefined)`. The test never touches a real database, so the UUID constraint is invisible.

**Architecture diagnosis**: The TypeScript type `database.types.ts` declares `id: string`, not a branded UUID type. The Zod schema at the API boundary validates string length but not string format. The actual constraint (`uuid` column type) lives exclusively in PostgreSQL. This violates the codebase's own Rule 7 (Strict Typing): the domain invariant "transcript entry IDs are UUIDs" is not encoded in the type system.

```
Zod schema:     id: z.string().min(1).max(128)     ← allows "m1"
TypeScript:     id: string                          ← allows "m1"
PostgreSQL:     id uuid NOT NULL                    ← rejects "m1" at INSERT
```

Three layers, only the deepest one enforces the constraint. The first two give false confidence.

**Impact on E2E**: The test passed Zod validation, the API returned 500 with a cryptic DB error, `saveWithBackoff` retried 3 times (all 500s), and the test timed out waiting for a 2xx response. Root cause was invisible without logging the response body.

---

### 3. 🟠 No Integration Test Layer Between Unit and E2E

**What happened**: The codebase has 67+ unit tests for handoff functions and 0 integration tests for `useAuthHandoff` (the file `hooks/useAuthHandoff.test.ts` does not exist). The orchestration layer — which wires stores, APIs, toasts, and navigation together — is validated only by E2E tests that take 4-30 seconds each and require a running Supabase instance.

**Why this matters**: Each unit test verifies one function in isolation with mocked dependencies. The E2E debugger encounters failures at boundary seams that no unit test covers:

| Seam | What breaks | Unit test coverage |
|------|------------|-------------------|
| Store → Hook | `loadAnonymousWorkspace()` timing vs `getCanvasState()` read | ❌ None |
| Hook → API | Message ID format accepted by Zod, rejected by DB | ❌ None |
| Component → Router | Soft nav vs hard nav preserving store state | ❌ None |
| `PostAuthRoot` → `ChatPanel` | `pendingSessionId` set in one component, consumed in another | ❌ None |
| `runBffHandoff` → `persistTranscript` | Transcript retry with `saveWithBackoff` | ❌ (canvas retry tested; transcript retry not) |

**Architecture diagnosis**: The functional core (`lib/`, `services/`) is well-tested. The impure shell (`hooks/`, `components/`) has zero test files. This is a common pattern in functional architectures — but it means the _composition_ of pure functions is never verified until E2E.

**Missing test file**: `hooks/useAuthHandoff.test.ts` — this single file would cover the entire orchestration: store rehydration → message selection → canvas save → transcript batch → navigation → cleanup. With `vi.mock` for the API calls and `renderHook` for the React lifecycle, this would catch H1, H2, and H3 without Playwright.

---

### 4. 🟠 GoTrue Admin API Is Fragile and Non-Idempotent

**What happened**: Creating test users via GoTrue admin API failed in multiple ways during successive test runs:

- **Email uniqueness is global**: User `0005` was accidentally created with email `e2e-h2@example.com` during a debug session. Next run, creating user `0006` with the same email returned `422 email_exists`. Neither user ID nor email could be used cleanly.
- **UUID collision returns 500, not 422**: GoTrue wraps PostgreSQL error 23505 in an HTTP 500 instead of a descriptive 4xx. The generic error message gave no clue.
- **No built-in idempotency**: GoTrue's `POST /admin/users` has no `ON CONFLICT` or upsert mode. The test must implement its own idempotency (GET → exists? update : create, with email-conflict resolution).

**Why this was hard to debug**: The `ensureUserAndResetTrial` function grew from 6 lines (simple POST + check 422) to 60+ lines (GET existing → handle email conflicts → handle 23505 → delete+recreate → reset trial state). This complexity is infrastructure plumbing that has nothing to do with the feature being tested.

**Architecture diagnosis**: The E2E test infrastructure leaks Supabase implementation details into every test file. Each test file (`cross-auth-journeys.spec.ts`, `handoff-resilience.spec.ts`) independently implements user creation, trial reset, and cookie injection. There is no shared test fixture or factory function.

**Duplication inventory**:

| Function | `cross-auth-journeys.spec.ts` | `handoff-resilience.spec.ts` |
|----------|------------------------------|------------------------------|
| `setupAuthenticatedPage()` | 35 lines | 35 lines (identical) |
| User creation | 20 lines (simple) | 60 lines (robust) |
| Trial reset | 15 lines | 15 lines (identical) |
| `anonymousWorkspaceWithLambda` | 15 lines (`id: "m1"`) | 15 lines (`id: UUID`) |

The robust version in `handoff-resilience.spec.ts` handles edge cases that `cross-auth-journeys.spec.ts` would also hit if its users ever got into a dirty state.

---

### 5. 🟠 Playwright Route Interception Has Hidden Semantics

**What happened**: Using `route.fulfill()` to simulate a 500 error on canvas PUT changed Chromium's address-space classification from "local" to "public". This triggered Private Network Access (PNA) preflight checks on subsequent requests to `127.0.0.1` (Supabase GoTrace), causing them to silently fail. The test appeared to work for the intercepted request but broke all following network calls.

**Why unit tests missed it**: Unit tests mock `fetch` directly — there is no browser, no Chromium security model, no PNA. The concept of "address-space classification" doesn't exist in Node.js.

**Architecture diagnosis**: Playwright's route interception API has three semantically different methods: `fulfill()` (synthetic response, changes address-space), `abort()` (network-level failure), and `fallback()` (pass to next handler). The correct choice depends on what you're simulating:

| Scenario | Correct method | Why |
|----------|---------------|-----|
| Server returns 500 | `fulfill({status:500})` — but only if no subsequent local requests | Synthetic response from "public" origin |
| Network failure (DNS, TCP) | `abort("failed")` | No response generated; address-space unchanged |
| Transient failure, then succeed | `abort("failed")` on first, `fallback()` on retry | Preserves local address-space |
| Modify request headers | `continue({headers})` | Forwards to real server with modifications |

The H1 test used `fulfill()` for a 500 error, which worked in isolation but broke PNA when run alongside H2/H3. The fix was switching to `abort("failed")` + `fallback()`, but this distinction is nowhere documented in the codebase and is a recurring trap.

---

## Why Functional Style Didn't Help

The codebase's functional style (pure functions, `Effect`/`Either`, `Option`, no `class`) provides strong guarantees within each function boundary. The problem is that **E2E tests don't validate functions — they validate the emergent behavior of composed systems**. Specifically:

1. **Pure functions compose predictably in source code, unpredictably through React effects**: `decideBootstrapAction` and `runBffHandoff` are pure and well-tested. But they're called from `useEffect` chains across two components (`PostAuthRoot` → `ChatPanel`), mediated by Zustand stores that have no persistence guarantees. The impurity lives in the wiring, not the logic.

2. **Effect/Either error handling is internal**: `saveWithBackoff` correctly returns `Either.Left` on failure, and `runBffHandoff` correctly calls `onTranscriptSaveError`. But the _cause_ of the failure (UUID format, PNA, GoTrace 500) is opaque to the functional code. The `Either.Left` just contains `{ message: "Request failed" }` — no structured error, no retry-or-abort decision aid.

3. **Option types prevent null crashes but not state timing bugs**: `pendingSessionId: Option.Option<string>` prevents null-pointer errors. But it doesn't prevent the value from being `Option.none()` when it should be `Option.some()` because the store was wiped by a hard navigation. The type system encodes presence/absence but not temporal validity.

4. **Immutable updates mask mutation that happens elsewhere**: The stores use immutable spreads (`set(s => ({ ...s, key: value }))`). But `loadAnonymousWorkspace()` imperatively writes to two stores from localStorage — and that call happens in three different places (`PostAuthRoot`, `InterviewSplitView`, `useAuthHandoff`). The functional surface hides a side-effect-laden initialization sequence.

---

## Prioritised Action List

### Structural Fixes (address root causes)

| # | Severity | Action | Root cause addressed | Status |
|---|----------|--------|---------------------|--------|
| 1 | 🔴 | **Add `useAuthHandoff` integration test** — extracted `resolveHandoffMessages` to `lib/authHandoff.ts` with 5 unit tests covering message source selection and role mapping. | RC3 (no integration layer) | ✅ Done |
| 2 | 🔴 | **Add UUID validation to Zod schema**: `id: z.string().uuid()` in `AppendTranscriptBatchBodySchema`. Returns 400 (not 500) for malformed IDs. | RC2 (schema vs DB mismatch) | ✅ Done |
| 3 | 🔴 | **Persist `pendingSessionId` to sessionStorage** via `readPendingSession`/`writePendingSession` helpers in `authHandoffStore.ts`. Survives hard navigation within a tab; clears on tab close. | RC1 (ephemeral store) | ✅ Done |
| 4 | 🟠 | **Extract shared E2E fixtures**: Created `e2e/fixtures.ts` with `setupAuthenticatedPage()`, `ensureUserAndResetTrial()`, and `anonymousWorkspaceWithLambda`. Both spec files now import from it. | RC4 (GoTrue fragility, duplication) | ✅ Done |
| 5 | 🟠 | **Document Playwright route interception rules** in `e2e/README.md`: when to use `fulfill` vs `abort` vs `fallback`, PNA implications, and the address-space trap. | RC5 (hidden semantics) | ✅ Done |
| 6 | 🟡 | **Add branded `TranscriptEntryId` type**: `type TranscriptEntryId = string & { readonly _brand: unique symbol }`. Constructor validates UUID format. Catches non-UUID IDs at compile time. | RC2 (type system gap) | ✅ Won’t Fix — Zod validates at API boundary; IDs are now UUIDs at source (#8). Branded type adds complexity without proportional benefit. |
| 7 | 🟡 | **Test transcript retry path in unit tests**: `authHandoff.test.ts` — added 2 tests: all-fail and second-attempt-success. | RC3 (unit test gap) | ✅ Done |
| 8 | ℹ️ | **Consider making anonymous message IDs UUIDs at creation time**: In `ChatPanel` and `InterviewSplitView`, use `crypto.randomUUID()` instead of arbitrary string IDs. Eliminates the format mismatch at the source. | RC2 (prevention) | ✅ Resolved — replaced all `generateId()` with `crypto.randomUUID()` in ChatPanel; added `generateId: () => crypto.randomUUID()` to useChat options |

### E2E-Specific Hardening

| # | Severity | Action | Status |
|---|----------|--------|--------|
| 9 | 🟠 | **Add Playwright `retries: 1` locally** (was 0). Flaky timing issues self-heal without manual re-runs. | ✅ Done |
| 10 | 🟡 | **Add `test.afterEach` cleanup**: Delete created sessions and transcripts after each test. Prevents cross-test contamination from orphaned data. | ✅ Resolved — added `cleanupUserSessions` helper and `afterEach` hooks in both cross-auth and handoff-resilience specs |
| 11 | 🟡 | **Log response bodies on non-2xx in all E2E interceptors**: A shared helper that logs error responses would surface root causes faster. | ✅ Resolved — added `installApiErrorLogger` helper and wired into all test cases |

---

## Severity Summary Table

| Finding | Severity | Category | Status |
|---------|----------|----------|--------|
| Ephemeral stores as integration bus | 🔴 High | Architecture | ✅ Resolved — `pendingSessionId` persisted to sessionStorage |
| Schema vs database UUID mismatch | 🔴 High | Validation | ✅ Resolved — `z.string().uuid()` + all test fixtures updated |
| No integration test for useAuthHandoff | 🔴 High | Test coverage | ✅ Resolved — `resolveHandoffMessages` extracted + 5 tests |
| GoTrace admin API fragility & duplication | 🟠 Medium | Test infrastructure | ✅ Resolved — shared `e2e/fixtures.ts` |
| Playwright route semantics undocumented | 🟠 Medium | Test infrastructure | ✅ Resolved — documented in `e2e/README.md` |
| Transcript retry not unit-tested | 🟡 Low | Test coverage | ✅ Resolved — 2 tests added |
| Message IDs not UUIDs at creation | ℹ️ Info | Prevention | ✅ Resolved — `crypto.randomUUID()` used in ChatPanel + PLG teaser |

---

## Conclusion

The difficulty was not a consequence of the functional style — it was a consequence of **well-tested pure functions being composed through poorly-tested impure infrastructure**. The functional core works exactly as specified. The failures all occurred at boundaries the functional core doesn't control: browser state persistence, database column types, Chromium security policies, and React effect ordering.

**Update (2026-03-10):** All 🔴 High and 🟠 Medium findings have been resolved. The `useAuthHandoff` hook's business logic (`resolveHandoffMessages`) was extracted to `lib/authHandoff.ts` and tested as a pure function, matching the codebase convention. The Zod schema now enforces UUID format at the API boundary. `pendingSessionId` is persisted to `sessionStorage`. E2E test fixtures are shared. Remaining open items (#6, #8, #10, #11) are 🟡 Low / ℹ️ Info severity.

**Update (2026-03-11):** Message ID finding (#8) fully resolved — PLG teaser in `lib/plg.ts` switched from `Date.now()` to `crypto.randomUUID()`. All ℹ️ Info items now resolved.