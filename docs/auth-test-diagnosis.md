# Auth test page – diagnosis

Minimal auth flow for root-cause analysis: no handoff, no session bootstrap.

## Page

- **URL:** `/auth-test`
- **Flow:** Sign in with Google → redirect to `/auth/callback?next=/auth-test` → callback exchanges code and redirects to `/auth-test`.

## Logging

### Client (browser console)

All client logs are prefixed with `[auth-test]`:

| Log | When | What to check |
|-----|------|----------------|
| `page_load` | Page mount | `pathname`, full `url` (includes `?code=...` if you landed with code) |
| `getSession_result` | After first `getSession()` | `hasSession`, `userId`, `email`, `error` |
| `onAuthStateChange` | Auth state changes | `event`, `hasSession`, `userId` |
| `signIn_redirectTo` | When you click Sign in | Exact `redirectTo` URL sent to Supabase |
| `logout` | When you click Log out | — |

**If you see `?code=...` in `page_load.url` on `/auth-test`:** the provider redirected to the wrong URL (e.g. site root or `/auth-test` with code). The callback route never ran; the code was never exchanged.

### Server (terminal running `pnpm dev`)

Callback route logs are prefixed with `[auth-callback]`:

| Log | When | What to check |
|-----|------|----------------|
| `request` | Callback GET | `hasCode`, `next`, `origin` |
| `exchangeCodeForSession` | After exchange | `ok`, `error`, `hasSession` |
| `redirect_error` | When redirecting to `/?error=...` | — |

**If you never see `[auth-callback] request`:** the browser never hit `/auth/callback` (e.g. redirect URI misconfigured at provider or Supabase).

**If `exchangeCodeForSession` has `ok: false`:** note `error` (e.g. `flow_state_expired`, `User not found`). That is the failure point.

## Local testing

1. Start dev server: `pnpm dev`.
2. Open http://localhost:3000/auth-test.
3. Open DevTools → Console. Filter by `[auth-test]` or `[auth-callback]` if needed.
4. Click “Sign in with Google”. Complete OAuth.
5. Compare:
   - **Console:** `page_load` (after redirect) → `getSession_result` → `onAuthStateChange`.
   - **Terminal:** `[auth-callback] request` → `exchangeCodeForSession` → redirect.
6. If login fails, note which log is missing or wrong (e.g. callback never hit, or exchange error).
