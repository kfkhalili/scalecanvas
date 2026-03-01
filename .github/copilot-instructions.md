# Copilot Instructions

These rules are hard requirements for every change in this codebase. No exceptions.

---

## 1. BFF & Bedrock

- Client code **never** calls AWS or Bedrock directly — only through `/api/chat`.
- AWS/Bedrock env vars are server-only: no `NEXT_PUBLIC_` prefix, never logged or bundled.
- `/api/chat`: auth check first (`!user` → 401 immediately), then `streamText` + `stream.toDataStreamResponse()`. Accept canvas (nodes, edges) in body; use pure `parseCanvasState(nodes, edges): string` for LLM context.

---

## 2. Effect & Either

- Fallible ops in `lib/` and `services/` return `Effect.Effect<T, E>`. Use `Effect.succeed`, `Effect.fail`, `Effect.tryPromise`, `Effect.flatMap`. No throwing in business logic.
- Route/component boundaries: `await Effect.runPromise(Effect.either(effect))` then `Either.match({ onLeft, onRight })` — **both branches always handled**.
- Supabase `{ data, error }`: use a ternary — `data ? Effect.succeed(convert(data)) : Effect.fail(...)`. Do **not** use `Option.fromNullable → match`.
- Use `ts-pattern` or exhaustive `.match()` for discriminated unions; every case handled.

---

## 3. Functional Core

- No `class`, `this`, or OOP anywhere. Pure functions and closures only.
- Business logic lives in `lib/` and `services/`. Components (`app/`, `components/`) only render and dispatch — no business decisions or side-effect orchestration inside components.
- Immutable updates only: `Readonly<>`, spread, or `structuredClone`. Never mutate in place. State setters: `set(s => ({ ...s, key: value }))`.

---

## 4. No Lint Suppressions

- Zero `eslint-disable`, `@ts-ignore`, or `@ts-expect-error`. Fix the root cause.
- No warnings committed. `eslint` and `tsc --noEmit` must pass clean with zero suppressions before every commit.

---

## 5. Option Instead of Null

- Use `Option<T>` in domain logic (stores, lib, services) for absent-or-present semantics. Keep `string | null` in DTOs, DB rows, and wire formats.
- `Option.match` only when **both** branches return a value. For imperative side-effects use `whenSome(opt, fn)` / `whenRight(either, fn)` from `@/lib/optionHelpers`.
- `getOrNull` only at true boundaries: DOM attributes, Supabase insert/update, JSON body, third-party APIs.
- Use `Option.getOrUndefined(x)` — never `Option.getOrNull(x) ?? undefined`.
- No `Option.fromNullable → immediate match/getOrElse`. Use a plain ternary instead.
- `useRef<T | null>(null)` for private mutable refs (timers, DOM refs). Option only when crossing component boundaries or part of derived state.
- Use `Option.all([a, b])` to combine multiple Options. Never nest `Option.match` inside `Option.match`.

---

## 6. Security — Defense in Depth

- Auth check (`supabase.auth.getUser()`) on every protected route. No user → `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` immediately. Never trust client-only checks.
- RLS on all tables (`auth.uid()`); assume the API layer can be bypassed.
- Secrets (Stripe, Supabase service role, AWS) are server-only — never `NEXT_PUBLIC_`, never in logs or bundle.
- Zod-validate all API inputs at boundaries. Enforce payload size limits and rate limiting on mutating endpoints.
- When building redirect URLs in server code, prefer `process.env.NEXT_PUBLIC_SITE_URL` over the `Origin` header.

---

## 7. Strict Typing

- No `any`. No `unknown` — use concrete types, unions, or branded types.
- Every function has explicit parameter and return types. Reuse types from `lib/` type modules.
- `strict: true` in tsconfig. No escape hatches — fix the type, don't widen it. No inline `object`.

---

## 9. Reports for Non-Code Tasks

When the user requests a non-code task — analysis, audit, review, planning, comparison, or any investigation that produces findings rather than code changes — always produce a **written report** as the primary deliverable:

- Create the report as a dated Markdown file in `docs/plans/` following the timestamped-filename rule (Rule 8).
- Structure it with: Executive Summary, numbered sections per category of finding, a severity-coded table, and a Prioritised Action List.
- Severity codes: 🔴 High · 🟠 Medium · 🟡 Low · ℹ️ Info.
- Cross-reference prior reports when they exist (do not repeat findings already marked resolved).
- The in-chat response may summarise key highlights, but the `docs/plans/` file is the canonical record.

---

## 8. Timestamped Filenames

For any file whose name includes a date or timestamp (Supabase migrations, dated docs):

1. **Create the file first** (use a placeholder name if needed).
2. **Run `stat`** on the created file to get its filesystem birth time:
   ```bash
   stat -f '%SB' -t '%Y%m%d%H%M%S' -- /path/to/file
   ```
3. **Rename** the file to use that birth time — never assume "today's date" or use any other source.

| Location               | Format                                              |
|------------------------|-----------------------------------------------------|
| `supabase/migrations/` | `{YYYYMMDDHHMMSS}_name.sql`                         |
| `docs/plans/`          | `{YYYY-MM-DD}-name.md`                              |
