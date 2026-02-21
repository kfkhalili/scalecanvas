# Trial Semantics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement profile-scoped one-time trial (trial_claimed_at), 0 default tokens for new users, and a single handoff API that creates a trial session only when eligible and never deducts tokens on handoff.

**Architecture:** Add `trial_claimed_at` to profiles; new RPC `claim_trial_and_create_session()` creates one trial session and sets the flag when null. POST /api/auth/handoff calls it and returns 201 { session_id } or 200 { created: false }. Client calls handoff API instead of deduct RPC; deduct_token_and_create_session always creates paid sessions (is_trial = false). New profiles get tokens default 0 via migration; existing users with sessions get trial_claimed_at set so they are not eligible.

**Tech Stack:** Next.js App Router, Supabase (migrations, RPC, RLS), TypeScript, neverthrow, Zod, Vitest.

---

## Task 1: Migration — trial_claimed_at, tokens default 0, backfill

**Files:**
- Create: `supabase/migrations/20260222000000_trial_claimed_at_and_tokens_default.sql`

**Step 1: Write the migration**

Create the migration file with:

- Add column `trial_claimed_at timestamptz null` to `public.profiles` (default null).
- Backfill: `update public.profiles set trial_claimed_at = now() where id in (select user_id from public.interview_sessions);` so any profile that already has at least one session is marked as trial claimed.
- Change default for `tokens`: `alter table public.profiles alter column tokens set default 0;` (existing rows keep current value; only new inserts get 0).
- Comment on `trial_claimed_at`: 'Set once when user claims one-time trial (handoff); null = eligible for trial.'

**Step 2: Run migration locally**

Run: `cd /Users/Q407910/git/faang-trainer && npx supabase db reset`

Expected: All migrations apply including the new one; no errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260222000000_trial_claimed_at_and_tokens_default.sql
git commit -m "chore(db): add trial_claimed_at, tokens default 0, backfill existing users"
```

---

## Task 2: RPC claim_trial_and_create_session

**Files:**
- Create: `supabase/migrations/20260222010000_claim_trial_rpc.sql`
- Modify: `lib/database.types.ts` (add RPC type)

**Step 1: Write the RPC migration**

In the new migration file:

- `create or replace function public.claim_trial_and_create_session(p_title text default null) returns uuid language plpgsql security definer set search_path = '' as $$ ... $$`
- Logic: get uid = auth.uid(); if null raise. Select trial_claimed_at from profiles where id = uid for update. If trial_claimed_at is not null, raise exception 'Trial already claimed' (or return null — design: raise so caller gets explicit error). If null: insert into interview_sessions (user_id, title, is_trial) values (uid, p_title, true) returning id into new_id; update profiles set trial_claimed_at = now(), updated_at = now() where id = uid; return new_id.
- Comment on function.

**Step 2: Run migration**

Run: `npx supabase db reset`

Expected: Migration applies.

**Step 3: Add RPC to database types**

In `lib/database.types.ts`:
- Add `trial_claimed_at: string | null` to `DbProfile` and optional to `DbProfileInsert`/`DbProfileUpdate` if needed.
- Under `Database['public']['Functions']` add `claim_trial_and_create_session` with args `{ p_title: string | null }` and return type uuid (follow existing RPC typing pattern from `deduct_token_and_create_session`).

**Step 4: Commit**

```bash
git add supabase/migrations/20260222010000_claim_trial_rpc.sql lib/database.types.ts
git commit -m "feat(db): add claim_trial_and_create_session RPC and profile trial_claimed_at type"
```

---

## Task 3: deduct_token_and_create_session always paid

**Files:**
- Create: `supabase/migrations/20260222020000_deduct_always_paid.sql`

**Step 1: Write the migration**

Replace the RPC so that the insert into interview_sessions uses `is_trial = false` always (remove the session_count logic that set is_trial = (session_count = 0)). Keep the rest (tokens check, decrement, insert) the same.

**Step 2: Run migration**

Run: `npx supabase db reset`

**Step 3: Commit**

```bash
git add supabase/migrations/20260222020000_deduct_always_paid.sql
git commit -m "fix(db): deduct_token_and_create_session always creates paid session (is_trial false)"
```

---

## Task 4: Handoff API schema and service

**Files:**
- Modify: `lib/api.schemas.ts` (add HandoffBodySchema, HandoffResponse types)
- Create or modify: `services/handoff.ts` (server-side: call RPC or wrap in Result)

**Step 1: Add Zod schema and types**

In `lib/api.schemas.ts` add:

- `HandoffBodySchema = z.object({ question_title: z.string().nullable().optional() })`
- Export type for handoff response: `{ created: true, session_id: string } | { created: false }` (or use inferred type from schema).

**Step 2: Write failing test for handoff service**

Create `services/handoff.test.ts` (or add to existing test file). Test: given Supabase client that returns trial_claimed_at null and RPC returns session id, claimTrialAndCreateSession returns ok(sessionId). Test: given client where RPC raises 'Trial already claimed', returns err. Use vi.mock for Supabase.

**Step 3: Run test to verify it fails**

Run: `pnpm vitest run services/handoff.test.ts`

Expected: FAIL (function or module not implemented yet).

**Step 4: Implement handoff service**

Create `services/handoff.ts`: function `claimTrialAndCreateSession(client, userId, title?: string | null): Promise<Result<string, { message: string }>>`. Call client.rpc('claim_trial_and_create_session', { p_title: title ?? null }). Map response to ok(session_id) or err. Handle "Trial already claimed" as err.

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run services/handoff.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add lib/api.schemas.ts services/handoff.ts services/handoff.test.ts
git commit -m "feat(handoff): add HandoffBodySchema and claimTrialAndCreateSession service"
```

---

## Task 5: POST /api/auth/handoff route

**Files:**
- Create: `app/api/auth/handoff/route.ts`
- Create: `app/api/auth/handoff/route.test.ts`

**Step 1: Write failing tests**

In `app/api/auth/handoff/route.test.ts`:
- Mock createServerClientInstance, getState().trial_claimed_at (or mock handoff service). Test: 401 when not authenticated. Test: 201 and { session_id } when trial claimed (mock RPC success). Test: 200 and { created: false } when trial already claimed (mock service returns err with 'Trial already claimed' or equivalent). Test: 400 for invalid body if applicable.

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run app/api/auth/handoff/route.test.ts`

Expected: FAIL (route or handler not implemented).

**Step 3: Implement route**

In `app/api/auth/handoff/route.ts`:
- POST only. Get user via createServerClientInstance + getUser(). If !user return 401.
- Parse body with HandoffBodySchema.safeParse(await request.json()). If !parsed.success return 400.
- Call claimTrialAndCreateSession(supabase, user.id, parsed.data.question_title ?? null). If ok(sessionId) return NextResponse.json({ created: true, session_id: sessionId }, { status: 201 }). If err return NextResponse.json({ created: false }, { status: 200 }) (trial already claimed or any error → same response so client always can resume).

**Step 4: Run tests**

Run: `pnpm vitest run app/api/auth/handoff/route.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/auth/handoff/route.ts app/api/auth/handoff/route.test.ts
git commit -m "feat(api): add POST /api/auth/handoff for trial claim or created: false"
```

---

## Task 6: Client handoff API and PostAuthRoot

**Files:**
- Create or modify: `services/handoffClient.ts` (fetch POST /api/auth/handoff, return Result)
- Modify: `components/PostAuthRoot.tsx`

**Step 1: Write handoffClient**

In `services/handoffClient.ts`: `postHandoff(questionTitle?: string | null): Promise<Result<{ created: true; session_id: string } | { created: false }, { message: string }>>`. POST to /api/auth/handoff with credentials include, body { question_title: questionTitle ?? null }. On 401/500 return err. On 201 parse json and return ok({ created: true, session_id }). On 200 return ok({ created: false }).

**Step 2: Write failing test for handoffClient**

In `services/handoffClient.test.ts`: mock fetch. Test: 201 with session_id returns ok({ created: true, session_id }). Test: 200 returns ok({ created: false }). Test: 401 returns err.

**Step 3: Run test**

Run: `pnpm vitest run services/handoffClient.test.ts`

Expected: PASS after implementation.

**Step 4: Update PostAuthRoot**

In `components/PostAuthRoot.tsx`:
- Replace call to deductTokenAndCreateSession(supabase) in the anonymous-handoff branch with postHandoff(questionTitle). On result.match: if created true, set session_id, rename session if questionTitle, setPendingAuthHandoff(session_id). If created false, clear handoff state (setAnonymousMessages([]), setQuestionTitle(null)), then fetchSessions and redirect to list[0] if any. Remove import of deductTokenAndCreateSession for this path; keep fetchSessions and renameSessionApi.

**Step 5: Run full test suite**

Run: `pnpm vitest run`

Expected: All tests pass. Fix any broken tests (e.g. sessionBootstrap or PostAuthRoot tests that assumed deduct path).

**Step 6: Commit**

```bash
git add services/handoffClient.ts services/handoffClient.test.ts components/PostAuthRoot.tsx
git commit -m "feat(client): use POST /api/auth/handoff in PostAuthRoot instead of deduct RPC"
```

---

## Task 7: Profile trigger and new-user tokens

**Files:**
- Modify: `supabase/migrations/20260219200000_initial_schema.sql` — do NOT edit (existing migration). Ensure new migration in Task 1 sets tokens default 0 so that handle_new_user() insert (which does not specify tokens) gets 0 for new users. If the trigger explicitly inserts tokens, add a new migration that changes the trigger to omit tokens (so default 0 applies). Check: handle_new_user inserts (id, email, full_name, avatar_url) only — so tokens use column default. Migration in Task 1 already sets default 0. No extra change needed unless trigger is different. Skip this task if verified.

**Verification:** After Task 1, create a new user (e.g. via Supabase Auth signUp) and confirm profile has tokens = 0 and trial_claimed_at = null. If trigger is in initial_schema and doesn't set tokens, default 0 from migration is enough.

---

## Task 8: Update sessionBootstrap and tests

**Files:**
- Modify: `lib/sessionBootstrap.ts` (if it still references deduct for handoff — may be unused by PostAuthRoot but used by tests)
- Modify: `lib/sessionBootstrap.test.ts` (deps no longer need deductTokenAndCreateSession for handoff; or keep for "New session" flow only)

**Step 1: Align bootstrap with design**

PostAuthRoot no longer uses sessionBootstrap for the handoff path (it calls handoff API directly). sessionBootstrap may still be used for resume_or_idle and redirect_login. Check: executeBootstrapAction deduct_and_handoff is not used by PostAuthRoot anymore. So either remove deduct_and_handoff from bootstrap and have only resume_or_idle and redirect_login, or leave bootstrap as-is for potential reuse. Design doc says client calls handoff API; so bootstrap's deduct_and_handoff path is obsolete. Remove deduct_and_handoff from BootstrapAction and executeBootstrapAction; decideBootstrapAction when hasAnonymousChat should now return something that means "call handoff API" — but the API is called from PostAuthRoot directly, not via bootstrap. So simplify: decideBootstrapAction when hasAnonymousChat returns e.g. "handoff" and executeBootstrapAction for "handoff" would call a passed-in handoffFn(). That keeps bootstrap testable. Or: leave bootstrap as-is and have PostAuthRoot not use it for the handoff branch (current state after Task 6). Then sessionBootstrap tests that test deduct_and_handoff are testing dead code. Option: remove deduct_and_handoff from bootstrap entirely; decideBootstrapAction with hasAnonymousChat returns a new action "handoff" that executeBootstrapAction handles by calling deps.handoff() (which returns Promise<{ created: boolean, session_id?: string }>). Then PostAuthRoot would use bootstrap with handoff deps that call postHandoff. That refactor is optional. Simpler: PostAuthRoot does not use sessionBootstrap for the handoff path (Task 6). So bootstrap still has deduct_and_handoff in the type and executeBootstrapAction; we just don't call it from PostAuthRoot. Then we don't need to change sessionBootstrap for this feature. Only ensure tests pass. If any test assumed "handoff path deducts token," update test to reflect "handoff is now API call from PostAuthRoot" (e.g. remove or adjust that test). Proceed with minimal change: run tests, fix failures. If sessionBootstrap.test.ts fails because it mocks deductTokenAndCreateSession and the component no longer calls it in one path, the component now calls postHandoff; so the test file for PostAuthRoot or the bootstrap tests might need updates. Do this in Task 8.

**Step 2: Run tests and fix**

Run: `pnpm vitest run`

Fix any failures in sessionBootstrap or PostAuthRoot (e.g. update mocks or remove obsolete deduct path from bootstrap and its tests).

**Step 3: Commit**

```bash
git add lib/sessionBootstrap.ts lib/sessionBootstrap.test.ts
git commit -m "chore: align sessionBootstrap with handoff API (remove or keep deduct path for tests)"
```

---

## Task 9: Database types and profile trigger (tokens default)

**Files:**
- Modify: `lib/database.types.ts` (ensure DbProfile has trial_claimed_at; already done in Task 2)
- Verify: New users get tokens = 0. If trigger in initial_schema inserts without tokens, default 0 from Task 1 migration applies. No trigger change in historical migration. Done.

---

## Task 10: Integration check and docs

**Files:**
- Modify: `docs/plans/2026-02-21-trial-semantics-design.md` (set Status: Implemented)

**Step 1: Manual verification**

- Start app and Supabase. Sign up a new user (or use one with trial_claimed_at null). As anonymous, get a question, then sign in. Expect: one session created, no token deduction, trial_claimed_at set. Sign out, sign in again with anonymous chat: expect 200 created false, no new session.
- Existing user (trial_claimed_at set): handoff should return created false.

**Step 2: Update design doc status**

Set Status to Implemented in the design doc.

**Step 3: Commit**

```bash
git add docs/plans/2026-02-21-trial-semantics-design.md
git commit -m "docs: mark trial semantics design as implemented"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Migration: trial_claimed_at, tokens default 0, backfill |
| 2 | RPC claim_trial_and_create_session + DB types |
| 3 | deduct_token_and_create_session always is_trial false |
| 4 | HandoffBodySchema + claimTrialAndCreateSession service + tests |
| 5 | POST /api/auth/handoff route + tests |
| 6 | handoffClient + PostAuthRoot use handoff API |
| 7 | Verify profile trigger / new-user tokens (skip if already correct) |
| 8 | sessionBootstrap and test fixes |
| 9 | DB types verification |
| 10 | Integration check + design doc status |

---

**Plan complete and saved to `docs/plans/2026-02-21-trial-semantics-implementation.md`.**

Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open a new session with executing-plans in the same worktree for batch execution with checkpoints.

Which approach do you want?
