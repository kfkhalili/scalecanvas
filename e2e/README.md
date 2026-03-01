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
  2. **Same + simulate time expiry** – After handoff, click “Simulate time expired (test)”, assert canvas is read-only and state correct after refresh.

These specs run in the default **chromium** project. They require **local Supabase** so the JWT secret matches (`e2e/jwtBypass.ts` uses the standard local secret). Set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (or `http://localhost:54321`) in `.env.local`; if you use a hosted Supabase URL, these tests are **skipped** with a clear message. Suitable for CI when using local Supabase.
