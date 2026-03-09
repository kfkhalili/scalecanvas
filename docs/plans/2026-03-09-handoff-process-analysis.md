# Auth Handoff Process — Deep Analysis & Improvement Report

**Date**: 2026-03-09
**Scope**: End-to-end anonymous → authenticated handoff flow
**Files analysed**: 60+
**Severity codes**: 🔴 High · 🟠 Medium · 🟡 Low · ℹ️ Info

---

## Executive Summary

The handoff process converts an anonymous user's canvas drawing and chat transcript into a persisted trial interview session upon registration. The flow spans 8 phases across localStorage, Zustand stores, an RPC-based server endpoint, and two fire-and-forget client API calls. While the happy path works reliably, the analysis reveals **5 high-severity issues** around data loss, race conditions, and missing error recovery; **5 medium-severity issues** around performance and UX; and several low-severity maintenance risks. The most critical finding is that canvas persistence is fire-and-forget with a single 400ms retry, meaning user work can be silently lost.

---

## 1. End-to-End Flow

### Phase 1 — Anonymous Session
- User lands on `/` → `InterviewSplitView` renders with `isAnonymous=true`.
- All state persisted to a **single localStorage key** (`scalecanvas-anonymous-workspace`):
  - `anonymousMessages[]`, `questionTitle`, `questionTopicId`
  - `nodes`, `edges`, `viewport`
  - `hasAttemptedEval`
- Two Zustand store subscriptions fire `persistAnonymousWorkspace()` on **every** store change (no debounce).

### Phase 2 — PLG Gate
- User clicks "Evaluate" → `performAnonymousEvalHandoff()` ([lib/plg.ts](../../lib/plg.ts)):
  - Sets `hasAttemptedEval = true`
  - Appends teaser message (`PLG_TEASER_MESSAGE`) to chat
  - User sees sign-in prompt

### Phase 3 — OAuth Redirect & Return
- User signs in → OAuth callback at `app/auth/callback/route.ts` exchanges code for session → redirects to `/`.
- Supabase auth cookie now present.

### Phase 4 — PostAuthRoot Bootstrap
- `PostAuthRoot` mounts ([components/PostAuthRoot.tsx](../../components/PostAuthRoot.tsx)):
  1. `loadAnonymousWorkspace()` restores localStorage → Zustand stores
  2. `queueMicrotask(() => setStoresReady(true))` — one-tick delay
  3. `supabase.auth.getUser()` confirms authenticated user
  4. `decideBootstrapAction(hasUser=true, hasAnonymousChat=true)` → `{ type: "handoff" }` ([lib/sessionBootstrap.ts](../../lib/sessionBootstrap.ts))
  5. `executeBootstrapAction` calls `doHandoff(questionTitle)`

### Phase 5 — Trial Claim (Server)
- `POST /api/auth/handoff` ([app/api/auth/handoff/route.ts](../../app/api/auth/handoff/route.ts)):
  1. Auth check (401 if no user)
  2. Rate-limit check (`HANDOFF_RATE_LIMIT` — 5/min per user)
  3. Zod-validate body: `{ question_title: string | null }`
  4. RPC `claim_trial_and_create_session` (atomic: `SELECT ... FOR UPDATE` → insert session → update `trial_claimed_at`)
  5. Response: `201 { created: true, session_id }` or `200 { created: false }`

### Phase 6 — Navigate to New Session
- On `created=true`:
  - `setPendingAuthHandoff(Option.some(sessionId))` in Zustand
  - `router.replace(/[sessionId])`
- On `created=false` (trial already claimed):
  - Clear anonymous state, fetch most recent session, redirect there

### Phase 7 — Canvas & Transcript Persistence (Client-Side)
- `useAuthHandoff` hook ([hooks/useAuthHandoff.ts](../../hooks/useAuthHandoff.ts)) detects `pendingSessionId`:
  1. Calls `loadAnonymousWorkspace()` again (rehydrate from localStorage)
  2. Calls `runBffHandoff()` ([lib/authHandoff.ts](../../lib/authHandoff.ts)):

  **Canvas save** (fire-and-forget):
  ```
  saveCanvasApi(sessionId, state) → PUT /api/sessions/[id]/canvas → upsert canvas_states
  ```
  - Not awaited. If it fails, retried once after 400ms. On second failure: toast.
  - Navigation proceeds regardless.

  **Transcript append** (sequential, awaited):
  ```
  for each filtered message:
    appendTranscriptApi(sessionId, role, content) → POST /api/sessions/[id]/transcript
  ```
  - Each message is a separate HTTP request, awaited sequentially.
  - No deduplication, no batch endpoint.

  **Completion**:
  - Sets `handoffTranscript` in Zustand (for immediate UI rendering)
  - Clears `pendingSessionId`, `anonymousMessages`, `questionTitle`
  - Calls `router.replace(/[sessionId])` to finalize

### Phase 8 — Session Page Display
- `InterviewSplitView` checks `isPendingHandoffSession`:
  - If `true` → uses in-memory state, skips API fetch
  - If `false` → normal fetch from DB
- Canvas and transcript render from either in-memory or API data

---

## 2. State Inventory

### Anonymous Phase (localStorage)

| Store | Field | Persisted Format | Notes |
|-------|-------|-----------------|-------|
| `authHandoffStore` | `anonymousMessages` | `AnonymousMessage[]` | Chat backup |
| `authHandoffStore` | `questionTitle` | `string \| null` | Nullable in storage, `Option` in store |
| `authHandoffStore` | `questionTopicId` | `string \| null` | Stable across refreshes |
| `canvasStore` | `nodes` | `unknown[]` | ReactFlow nodes |
| `canvasStore` | `edges` | `unknown[]` | ReactFlow edges |
| `canvasStore` | `viewport` | `Viewport \| null` | Was Effect `Option` in legacy |
| `canvasStore` | `hasAttemptedEval` | `boolean` | PLG gate flag |

### In-Transit (Zustand, not persisted)

| Field | Type | Lifetime |
|-------|------|----------|
| `pendingSessionId` | `Option<string>` | Set after handoff API → cleared after `runBffHandoff` completes |
| `handoffTranscript` | `Option<{sessionId, entries}>` | Set after transcript persist → consumed by InterviewSplitView |

### Database (post-handoff)

| Table | Created By | Timing |
|-------|-----------|--------|
| `interview_sessions` (is_trial=true) | RPC `claim_trial_and_create_session` | Phase 5 |
| `profiles.trial_claimed_at` | Same RPC (atomic) | Phase 5 |
| `canvas_states` | `saveCanvasApi` (fire-and-forget) | Phase 7 |
| `session_transcripts` | `appendTranscriptApi` (N sequential) | Phase 7 |

---

## 3. Findings

### 🔴 High Severity

#### H1 — Canvas Save Is Fire-and-Forget with Insufficient Retry

**Location**: [lib/authHandoff.ts](../../lib/authHandoff.ts) lines 36–49

```typescript
void trySave().then((first) => {
  if (Either.isRight(first)) return;
  setTimeout(() => {
    void trySave().then((second) =>
      Either.match(second, {
        onLeft: onCanvasSaveError,
        onRight: () => {},
      })
    );
  }, 400);
});
```

**Problem**: The canvas save is not awaited. The handoff flow immediately proceeds to persist the transcript and navigate. If the network is slow or the first request fails:
- Only one retry after a fixed 400ms delay (no exponential backoff)
- On permanent failure: a toast is shown, but the user has already navigated to the session page
- The toast disappears in ~5 seconds; user may never see it
- No "retry" button, no banner on the session page, no recovery path
- The user's entire diagram is silently lost

**Impact**: Loss of user work — the primary artefact of the anonymous session.

**Recommendation**:
1. Await the canvas save (or at least block navigation until resolved)
2. Implement exponential backoff with 3 retries
3. Show a persistent banner on the session page if canvas save is pending/failed
4. Store the canvas state in localStorage as fallback until DB confirmation received

---

#### H2 — Transcript Append Has No Retry and Can Partially Fail

**Location**: [hooks/useAuthHandoff.ts](../../hooks/useAuthHandoff.ts) lines 68–73

```typescript
for (const { role, content } of entries) {
  await Effect.runPromise(
    Effect.either(appendTranscriptApi(sid, role, content))
  );
}
```

**Problem**: Each message is appended as a separate HTTP request in a sequential loop. The `Effect.either` wrapping means failures are captured but **silently discarded** — the loop continues regardless. If message 3 of 5 fails:
- Messages 1–2 and 4–5 are persisted; message 3 is lost
- No indication to the user that part of their conversation was dropped
- No transactional guarantee — partial transcript left in the DB

**Additionally**: The `appendTranscriptApi` insert has no idempotency key. If a network timeout causes a retry at the HTTP level, duplicate rows can be created.

**Impact**: Silent data corruption — incomplete or duplicated conversation history.

**Recommendation**:
1. Replace sequential appends with a **batch insert endpoint** (single RPC or POST with array body)
2. Add idempotency via a client-generated message ID or `INSERT ... ON CONFLICT DO NOTHING`
3. If batch fails, retain messages in memory and retry with backoff
4. Show user feedback if transcript persistence fails

---

#### H3 — No Guard Against Multiple Simultaneous Handoff Calls

**Location**: [components/PostAuthRoot.tsx](../../components/PostAuthRoot.tsx) lines 42–85

**Problem**: `PostAuthRoot`'s `useEffect` fires when `storesReady` becomes `true`. There is no `handoffInProgressRef` guard. If React strict mode double-fires the effect, or if `storesReady` toggles rapidly due to a re-render race:
- Two `POST /api/auth/handoff` requests sent nearly simultaneously
- The first succeeds (201), the second gets 429 (rate limit) or 200 (`created: false`)
- `pendingSessionId` may be set/overwritten twice
- Two navigation calls compete

The RPC has a `FOR UPDATE` lock so the DB won't create duplicate sessions, but the client-side state machine can enter an inconsistent state.

**Impact**: State corruption, double navigation, confusing UI.

**Recommendation**: Add a `handoffInProgressRef` or Zustand `isHandoffInProgress` flag checked before calling `executeBootstrapAction`.

---

#### H4 — localStorage Quota Failure Is Silent

**Location**: [stores/anonymousWorkspaceStorage.ts](../../stores/anonymousWorkspaceStorage.ts) `persistAnonymousWorkspace()`

```typescript
try {
  localStorage.setItem(ANONYMOUS_WORKSPACE_KEY, JSON.stringify({ state, version: 0 }));
} catch {
  // quota or disabled
}
```

**Problem**: If localStorage is full or disabled (private browsing on some browsers), the entire anonymous workspace fails to persist — silently. The user continues working with no indication that their progress won't survive a page refresh or OAuth redirect.

**Impact**: Complete loss of anonymous work on auth redirect.

**Recommendation**:
1. Show a toast on first write failure: "Your progress may not be saved. Please sign in to preserve your work."
2. Consider falling back to `sessionStorage` or in-memory-only mode with a visible warning.

---

#### H5 — Canvas State Can Arrive After Session Page Fetches Empty Canvas

**Location**: [lib/authHandoff.ts](../../lib/authHandoff.ts) — canvas save is `void` (fire-and-forget), while `onHandoffComplete` triggers `router.replace`.

**Sequence**:
1. `runBffHandoff` fires canvas save (not awaited)
2. Transcript appends complete (awaited, ~1–2s)
3. `onHandoffComplete` → `router.replace(/[sessionId])`
4. Session page mounts → `InterviewSplitView` effect fetches canvas from DB
5. Canvas save hasn't reached the DB yet → empty canvas returned
6. Canvas save completes 500ms later → DB now has data, but UI already rendered empty

**Mitigation in-place**: The `isPendingHandoffSession` check causes the component to skip fetching and use in-memory state. However, this is fragile — if the `pendingSessionId` is cleared before the canvas effect runs (timing-dependent), the fallback fetch will return an empty canvas.

**Impact**: User's diagram appears blank on the session page; refreshing later shows it.

**Recommendation**: Await the canvas save before completing the handoff, or ensure the `isPendingHandoffSession` guard is airtight with a more explicit "handoff complete" state machine.

---

### 🟠 Medium Severity

#### M1 — Sequential Transcript Append Creates N+1 Network Requests

**Location**: [hooks/useAuthHandoff.ts](../../hooks/useAuthHandoff.ts) lines 68–73

Each message requires a separate HTTP request. With 10 messages at 200ms latency each, the user waits ~2 seconds before navigation completes. On high-latency connections this can be 5+ seconds with no progress feedback.

**Recommendation**: Batch endpoint accepting an array of entries.

---

#### M2 — localStorage Writes on Every Zustand Store Change (No Debounce)

**Location**: [components/interview/InterviewSplitView.tsx](../../components/interview/InterviewSplitView.tsx) lines 74–75

```typescript
const unsubCanvas = useCanvasStore.subscribe(() => persistAnonymousWorkspace());
const unsubHandoff = useAuthHandoffStore.subscribe(() => persistAnonymousWorkspace());
```

Every mouse move during node drag, every viewport pan/zoom, every keystroke triggers a full `JSON.stringify` of the entire workspace and writes it to localStorage. During active drawing this can be 10–20 writes/second.

**Impact**: UI jank on slower devices; wasted CPU on serialization.

**Recommendation**: Debounce to 500–1000ms. Also consider selective persistence (only persist when nodes/edges actually change, not on viewport-only changes).

---

#### M3 — "Trial Already Claimed" Gives No User Feedback

**Location**: [lib/sessionBootstrap.ts](../../lib/sessionBootstrap.ts) lines 76–80

When the handoff returns `created: false`, the anonymous state is cleared and the user is silently redirected to their most recent session. The user has no idea what happened to the canvas they just drew.

**Recommendation**: Show a toast: "Your trial session was already created. Resuming your existing session."

---

#### M4 — 429 Rate-Limit Response Missing `Retry-After` Header

**Location**: [app/api/auth/handoff/route.ts](../../app/api/auth/handoff/route.ts) lines 22–25

The rate-limit response returns 429 with a JSON error message but no `Retry-After` header. The client has no guidance on when to retry.

**Recommendation**: Include `Retry-After` header, and have the client display the delay to the user.

---

#### M5 — No Progress Indicator During Transcript Persistence

**Location**: [hooks/useAuthHandoff.ts](../../hooks/useAuthHandoff.ts)

The 1–3 second wait for sequential transcript appends shows no UI progress. The user may think the app is frozen or try to interact with the page.

**Recommendation**: Show a progress toast or loading overlay: "Saving your conversation… (3/10)".

---

### 🟡 Low Severity

#### L1 — Option/Nullable Type Mismatch Between Store and Storage

`authHandoffStore` uses `Option<string>` for `questionTitle`; `PersistedAnonymousWorkspace` uses `string | null`. The `loadAnonymousWorkspace` function manually converts via `Option.fromNullable`. While correct today, this is a refactoring hazard — both types accept `null`, so a missing `fromNullable` call won't cause a type error.

---

#### L2 — Legacy Storage Migration Code Has No Sunset

`migrateFromLegacyKeys()` in `anonymousWorkspaceStorage.ts` migrates from two old localStorage keys to the unified one. This code runs on every load. If no users remain on the legacy format, it should be removed.

---

#### L3 — `loadAnonymousWorkspace()` Called Twice During Handoff

Both `PostAuthRoot` and `useAuthHandoff` call `loadAnonymousWorkspace()`. The second call is a safety net but does redundant localStorage reads and Zustand state updates.

---

#### L4 — `handoffDoneRef` in `useAuthHandoff` Only Guards on Session ID Equality

If a different `pendingSessionId` is set (edge case: two tabs), the ref won't prevent double processing of the same session if cleared and re-set.

---

#### L5 — `queueMicrotask` Timing for `storesReady`

`PostAuthRoot` uses `queueMicrotask(() => setStoresReady(true))` to delay one tick after `loadAnonymousWorkspace()`. This works because localStorage reads are synchronous, but the pattern is implicit and fragile — a future async change to `loadAnonymousWorkspace` would break the assumption.

---

### ℹ️ Info

#### I1 — Canvas State Deserialization Not Cached

Every session page mount deserializes the canvas JSON from the DB. For large canvases (200+ nodes), this is redundant work if the user navigates away and back.

#### I2 — E2E Tests Cover Happy Path But Not Edge Cases

[e2e/cross-auth-journeys.spec.ts](../../e2e/cross-auth-journeys.spec.ts) tests the successful handoff flow. Missing coverage for: canvas save failure + retry, partial transcript failure, rate limiting, trial already claimed UX, browser back-button during handoff, concurrent tabs.

#### I3 — `performAnonymousEvalHandoff` Uses `Date.now()` for Teaser ID

The teaser message ID is `plg-teaser-${Date.now()}`. If called twice within the same millisecond (unlikely but possible on fast machines), duplicate IDs could appear.

---

## 4. Severity Summary Table

| # | Issue | Severity | Category | Impact | Fix Effort |
|---|-------|----------|----------|--------|------------|
| H1 | Canvas save fire-and-forget, 1 retry | 🔴 High | Data Loss | User's diagram silently lost | Medium |
| H2 | Transcript append no retry, partial failure | 🔴 High | Data Corruption | Incomplete chat history | Medium |
| H3 | No handoff-in-progress guard | 🔴 High | Race Condition | Double API calls, state corruption | Low |
| H4 | localStorage quota failure silent | 🔴 High | Data Loss | All anonymous work lost on redirect | Low |
| H5 | Canvas save arrives after page fetch | 🔴 High | Race Condition | Blank canvas on session page | Medium |
| M1 | Sequential transcript N+1 requests | 🟠 Medium | Performance | 2–5s blocking delay | Medium |
| M2 | localStorage writes per store change | 🟠 Medium | Performance | UI jank on slow devices | Low |
| M3 | "Trial claimed" no feedback | 🟠 Medium | UX | User confusion | Low |
| M4 | Missing Retry-After header | 🟠 Medium | API Contract | Client can't backoff intelligently | Low |
| M5 | No progress during transcript save | 🟠 Medium | UX | App appears frozen | Low |
| L1 | Option/null type mismatch | 🟡 Low | Maintenance | Future refactor risk | Low |
| L2 | Legacy migration no sunset | 🟡 Low | Maintenance | Dead code | Low |
| L3 | Double `loadAnonymousWorkspace` call | 🟡 Low | Redundancy | Minor wasted work | Low |
| L4 | `handoffDoneRef` guard limited | 🟡 Low | Reliability | Edge case with multiple tabs | Low |
| L5 | `queueMicrotask` timing assumption | 🟡 Low | Fragility | Breaks if load becomes async | Low |

---

## 5. Prioritised Action List

### Immediate (This Sprint)

1. **H3 — Add handoff-in-progress guard** in `PostAuthRoot`
   - Add `useRef<boolean>(false)` checked before calling `executeBootstrapAction`
   - Effort: ~30 min, high impact

2. **H4 — Toast on localStorage write failure**
   - In `persistAnonymousWorkspace`, catch and show toast on first failure
   - Effort: ~30 min

3. **H1 — Await canvas save with retry**
   - Change canvas save from fire-and-forget to awaited with 3 retries (exponential backoff)
   - Block `onHandoffComplete` until canvas is confirmed saved or exhausts retries
   - Show persistent error banner (not toast) on failure
   - Effort: ~2 hours

### Short-Term (Next Sprint)

4. **H2 — Batch transcript insert endpoint**
   - Create `POST /api/sessions/[id]/transcript/batch` accepting `{ entries: Array<{role, content}> }`
   - Server-side: single `INSERT INTO ... VALUES ...` or RPC
   - Add idempotency key (client-generated batch ID)
   - Effort: ~4 hours

5. **H5 — Ensure canvas is written before navigation** (partially resolved by H1)
   - If H1 is implemented, H5 is naturally fixed
   - Additional: Add explicit "handoff phase" state machine (pending → saving → complete) instead of relying on `isPendingHandoffSession` timing

6. **M3 — Toast for "trial already claimed"**
   - In `executeBootstrapAction`, when `result.created === false`, show explanatory toast
   - Effort: ~15 min

7. **M5 — Progress indicator during transcript save**
   - Show toast with progress count during batch save
   - Effort: ~30 min

### Medium-Term

8. **M1 — Batch transcript endpoint** (same as action 4)

9. **M2 — Debounce localStorage writes**
   - Replace direct subscribe with debounced callback (500ms)
   - Skip viewport-only changes
   - Effort: ~1 hour

10. **M4 — Add Retry-After to handoff 429 response**
    - Compute retry delay from rate-limit window, include in response header
    - Effort: ~30 min

11. **L1–L5 — Maintenance cleanup**
    - Remove legacy migration code if no users on old format
    - Deduplicate `loadAnonymousWorkspace` calls
    - Replace `queueMicrotask` with explicit ready state from load function
    - Effort: ~2 hours total

### Long-Term

12. **E2E test coverage** for failure scenarios (canvas save failure, partial transcript, rate limiting, concurrent tabs)
13. **Canvas state caching** with SWR or React Query to avoid redundant deserialization
14. **Error boundary** around the handoff flow with recovery UI