# E2E tests (Playwright)

Install browsers once:

```bash
pnpm exec playwright install
```

Run all e2e tests:

```bash
pnpm exec playwright test
```

## Anonymous → trial handoff test

The handoff test (`anonymous-handoff-canvas.spec.ts`) asserts that after sign-in, the anonymous canvas is saved to the new trial session and survives reload. It runs only when auth state exists.

**One-time setup**

1. Create auth state by running the setup test and signing in when the browser opens:
   ```bash
   pnpm exec playwright test e2e/auth.setup.ts
   ```
2. Complete sign-in with Google (or GitHub) in the opened browser. When you are redirected back to the app, auth state is saved to `e2e/.auth/user.json`.

After that, the handoff test runs automatically when you run the full suite (`pnpm exec playwright test`). If the auth state file is missing, the handoff test is not run. If it has expired, the test will skip with a message to re-run the setup.
