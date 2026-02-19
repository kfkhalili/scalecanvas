# FAANG-Trainer

System design interview practice: React Flow canvas (left) + AI interviewer chat (right). See [MVP_PLAN.md](./MVP_PLAN.md) for the implementation plan.

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

## Environment

Copy `.env.example` to `.env.local` and fill in:

- **Client:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- **Server (optional):** `SUPABASE_SECRET_KEY`
- **Server-only (BFF /api/chat):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID` — never use `NEXT_PUBLIC_` for these.

## Folder structure

- `app/` — routes, layouts, pages; API under `app/api/`
- `components/` — UI; `components/ui/` — shadcn primitives
- `lib/` — pure functions, types, utils
- `stores/` — Zustand stores
- `services/` — Supabase client, API calls
- `supabase/migrations/` — Supabase migrations (apply via CLI)

Coding rules: see `.cursor/rules/`.
