# Trial Semantics: Who Gets the Free Session — Design

**Date:** 2026-02-21  
**Status:** Implemented

---

## Problem

Today, "trial" is conflated with "first session" and "one token in the bucket." That leads to:

- New users having 1 token (so they can "spend" it on the handoff session), which blurs the message that the session they were shown when anonymous **is** the trial.
- Existing users who delete all sessions and sign in again could be treated as "new" if we used session count, giving them another free session.
- Token deduction must only happen when the user explicitly creates a new session (e.g. "New session" button), not as a side effect of handoff.

**Goal:** Clean semantics — **new = previously not registered**. The one-time trial is completing the session they were shown when anonymous, on first sign-in. After that, they are existing; no trial on later sign-ins. We never deduct tokens except when the user explicitly chooses to start a new session.

---

## Principles

1. **Trial is one-time per identity** — Tied to the profile, not to session count. So deleting all sessions and signing in again does **not** grant another trial.
2. **New users have 0 tokens** — The "free" thing is not a token; it's the right to complete the anonymous session (one trial session). Default `profiles.tokens = 0`.
3. **Deduction only on explicit action** — Tokens are only decremented when the user explicitly starts a new session (e.g. "New session" button). Handoff never deducts for existing users; for new users it creates the trial session without touching tokens.

---

## Data Model

### Profile

- **`trial_claimed_at`** (new): `timestamptz null`, default `null`.
  - `null` = user has never claimed the one-time trial (eligible for trial on first handoff).
  - Set once when they claim the trial (handoff creates that session); never reset.
- **`tokens`**: Default for **new** profiles is **0** (migration: change default from 1 to 0).
  - Existing profiles keep current token balance; only new rows get 0.

### Migration rules

- Add `trial_claimed_at` to `profiles`, default `null`.
- For existing users (any profile that already has at least one session): set `trial_claimed_at = now()` so they are not eligible for another trial.
- Change default for `tokens` to 0 for new inserts (existing rows unchanged).

---

## Handoff Behavior

Single source of truth on the server.

- **Eligible for trial** (`trial_claimed_at` is null) and user has anonymous handoff:
  - Create one session with `is_trial = true` (15-min limit).
  - Set `trial_claimed_at = now()` for that user.
  - Do **not** deduct tokens.
  - Return `{ created: true, session_id: "..." }`.
- **Not eligible** (`trial_claimed_at` is set):
  - Do **not** create a session.
  - Do **not** deduct tokens.
  - Return `{ created: false }`. Client clears handoff state and resumes (redirect to latest session or empty workspace).

So: **new** (trial not yet claimed) gets exactly one trial session from handoff. **Existing** (trial already claimed) never gets a session or deduction from handoff; they only get sessions by explicitly creating one (which deducts a token).

---

## API Shape

**Option B (recommended):** Single server endpoint for handoff.

- **POST /api/auth/handoff** (or **POST /api/sessions/from-handoff**)
  - Body: `{ question_title?: string | null }`.
  - Auth: required (session).
  - Server:
    - If `trial_claimed_at` is null: create session (`is_trial = true`), set `trial_claimed_at = now()`, no deduct; return `201 { session_id, title }` (title optional from body).
    - Else: return `200 { created: false }`.
  - Client: if `created: true`, set pending handoff, optionally rename session, then run existing BFF handoff flow. If `created: false`, clear handoff state (anonymous messages, question title), fetch sessions, redirect to latest or show empty.

No client-side "try trial RPC then deduct RPC"; one call, server decides.

---

## Session Creation Elsewhere

- **"New session" button** — Unchanged: calls `deduct_token_and_create_session`. Only path that deducts tokens. Sessions created this way are **paid** (`is_trial = false`, 60-min limit).
- **RPC `deduct_token_and_create_session`** — Stops setting `is_trial` from session count. Always creates a **paid** session (`is_trial = false`). Trial sessions are created only via the handoff endpoint above.

---

## Time Limits

- Trial session (`is_trial = true`): 15 minutes (unchanged).
- Paid session (`is_trial = false`): 60 minutes (unchanged).

---

## Summary

| Actor              | Handoff result                    | Tokens deducted? |
|--------------------|-----------------------------------|-------------------|
| New user (trial not claimed) | One session created, `trial_claimed_at` set | No                |
| Existing user      | No session created                | No                |
| Any user           | "New session" button              | Yes (if balance ≥ 1) |

Trial = one-time, profile-scoped, claimed on first handoff. New users have 0 tokens; the trial is "complete the session you were shown," not a token. Existing users never get a free session from handoff and only spend tokens when they explicitly create a new session.
