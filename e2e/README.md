# E2E tests (Playwright)

**Run e2e tests (installs Chromium if needed, then runs all specs):**

```bash
pnpm test:e2e:run
```

Or, if browsers are already installed:

```bash
pnpm test:e2e
```

To install browsers only: `pnpm exec playwright install chromium`

## Cross-auth user journeys (JWT bypass — no manual auth)

Cross-auth flows are fully testable **without** real OAuth or manual sign-in:

- **`e2e/cross-auth-jwt.spec.ts`** – Click “Sign in with Google” → request is intercepted, a JWT session is injected, redirect to app → assert authenticated.
- **`e2e/cross-auth-journeys.spec.ts`** – Full journeys using the same bypass:
  1. **Anonymous → sign in → handoff** – Preload anonymous workspace, go to `/`, click sign-in (bypass), assert redirect to trial session and canvas persisted, survives reload.
  2. **Same + end interview** – After handoff, click "End interview" (and confirm), assert canvas is read-only and state correct after refresh.

These specs run in the default **chromium** project. They require **local Supabase** so the JWT secret matches (`e2e/jwtBypass.ts` uses the standard local secret). Set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (or `http://localhost:54321`) in `.env.local`; if you use a hosted Supabase URL, these tests are **skipped** with a clear message. Suitable for CI when using local Supabase.

## CI on hosted Supabase (TEST-7)

When running CI against a hosted Supabase project the cross-auth journey specs are automatically skipped because `isLocalSupabase()` returns `false`. Two options to keep full coverage:

1. **Run local Supabase in CI** — add `supabase start` as a CI step (works with the [Supabase GitHub Action](https://github.com/supabase/setup-cli)). The JWT secret is deterministic (`super-secret-jwt-token-with-at-least-32-characters-long`) so `jwtBypass.ts` works without any config change.
2. **Dedicated CI Supabase project** — create a separate Supabase project, export its JWT secret as `SUPABASE_JWT_SECRET` in CI, and update `jwtBypass.ts` to read from that env var as a fallback.

## Route interception: `fulfill` vs `abort` vs `fallback`

Playwright route interception has hidden semantics around **Private Network Access (PNA)** that can silently break tests against `127.0.0.1` (local Supabase).

| Scenario | Method | Why |
|----------|--------|-----|
| Server returns an error (500, 503) | `route.fulfill({ status: 500, … })` | Synthetic response. **Caution**: changes Chromium address-space from "local" to "public", which triggers PNA preflight checks on subsequent requests to `127.0.0.1`. Only safe if no further local requests follow. |
| Simulate network failure (DNS, TCP) | `route.abort("failed")` | No response generated; address-space classification unchanged. Use for transient failures when you expect a retry to hit the real server. |
| Transient failure then succeed | `abort("failed")` on first call, `fallback()` on retry | Preserves local address-space so retries reach real endpoints. |
| Modify request headers (e.g. cookie injection) | `route.continue({ headers })` | Forwards to real server with modifications. Always safe. |
| Pass to next registered handler | `route.fallback()` | Defers to lower-priority handlers (e.g. cookie injection). |

**Key rule**: if the test runs against local Supabase and any subsequent request must reach `127.0.0.1`, prefer `route.abort("failed")` over `route.fulfill({ status: … })` for error simulation.
