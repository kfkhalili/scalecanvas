# ScaleCanvas

System design interview practice: React Flow canvas (left) + AI interviewer chat (right). See [MVP_PLAN.md](./MVP_PLAN.md) for the implementation plan.

**All coding rules in [`.cursor/rules/`](.cursor/rules/) are mandatory** — not optional. CI and pre-commit enforce lint, typecheck, and tests so the rules are followed.

## Stack

Next.js (App Router), Supabase, AWS Bedrock (Anthropic), Vercel AI SDK, React Flow, Tailwind CSS, TypeScript, shadcn/ui, Zustand, neverthrow, ts-pattern. **Package manager:** pnpm only.

## Setup

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL, publishable key, and (server-only) AWS/Bedrock vars
pnpm dev
```

## Scripts

- `pnpm dev` — start dev server (Turbopack)
- `pnpm build` — production build
- `pnpm start` — start production server
- `pnpm lint` — run ESLint
- `pnpm test` — run tests (Vitest)

## Enforcement

- **CI** (GitHub Actions): on push/PR to `main`, runs `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`. The build fails if any step fails.
- **Pre-commit** (husky): before each commit, runs `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`. Commit is blocked if any step fails. E2E tests (`pnpm test:e2e`) run in CI or manually, not in the commit hook.
- **lint-staged**: ESLint runs on staged `*.ts`/`*.tsx` when configured (e.g. for faster feedback).

## Environment

Copy `.env.example` to `.env.local` and fill in:

- **Client:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- **Server (optional):** `SUPABASE_SECRET_KEY`
- **Server-only (BFF /api/chat):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID` — never use `NEXT_PUBLIC_` for these.

### IAM for Bedrock (inference profile)

The IAM user used by `/api/chat` must allow both the **inference profile** and the **foundation model** (e.g. for Claude Sonnet 4.6). When using cross-region inference, the foundation model is evaluated as a region-agnostic resource (`arn:aws:bedrock:::foundation-model/...`), so the foundation-model ARN in the policy must use a region wildcard:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": [
      "arn:aws:bedrock:us-east-1:ACCOUNT_ID:inference-profile/global.anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-6"
    ]
  }]
}
```

Replace `ACCOUNT_ID` with your AWS account ID.

### Chat latency

Responses should stream and show the first tokens within a few seconds. If you see a long delay (e.g. 60–90s) before any output:

- **Try production:** `pnpm build && pnpm start` and test again (dev/Turbopack can behave differently).
- **Verify streaming:** The route sends `Cache-Control: no-store` and `X-Accel-Buffering: no` so the response isn’t buffered.
- **Inference profile:** A **geographic** profile in your region (e.g. `us.anthropic.claude-sonnet-4-6` from US) can be faster than the global one; see AWS Bedrock inference profiles docs.

## Folder structure

- `app/` — routes, layouts, pages; API under `app/api/`
- `components/` — UI; `components/ui/` — shadcn primitives
- `lib/` — pure functions, types, utils
- `stores/` — Zustand stores
- `services/` — Supabase client, API calls
- `supabase/migrations/` — Supabase migrations (apply via CLI)

Coding rules: see [`.cursor/rules/`](.cursor/rules/) — **mandatory** for all implementation.
