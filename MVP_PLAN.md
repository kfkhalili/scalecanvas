# FAANG-Trainer — MVP Implementation Plan

**Stack:** Next.js (App Router), Supabase, AWS Bedrock, Vercel AI SDK (`ai`), `@ai-sdk/amazon-bedrock`, React Flow, Tailwind CSS, TypeScript, shadcn/ui, Zustand, neverthrow, ts-pattern. **Package manager:** pnpm only.

**Architecture:** BFF at `/api/chat`; client never calls AWS. Auth via Supabase (session from cookies); streaming via `streamText`/`toDataStreamResponse()`; canvas in request body, pure `parseCanvasState(nodes, edges)` for LLM context.

**Hard rules (typing, lint, TDD, security, state, etc.)** are in **`.cursor/rules/`** — **mandatory** for all implementation; no exceptions.

---

## 1. Executive Summary

Split-screen app: **React Flow canvas** (left) for AWS architecture diagrams, **chat** (right) for a FAANG-style AI interviewer. Model: Anthropic Claude (Bedrock, Cross-Region Inference `anthropic.claude-sonnet-4-6`); all LLM via Next.js `/api/chat` BFF with streaming. Supabase for auth (GitHub/Google) and persistence (sessions, transcripts, canvas). Eight phases: bootstrap → auth → schema → session CRUD → split-screen + canvas → chat UI → BFF/streaming → E2E polish.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Left: React Flow Canvas  │  Right: Chat (useChat + canvas body) │
├───────────────────────────┴─────────────────────────────────────┤
│  Zustand: session, canvas, transcript. Sync with API.           │
├─────────────────────────────────────────────────────────────────┤
│  Next.js: /api/chat (BFF, stream) → Bedrock; /api/sessions/*    │
│  Supabase: Auth + PostgreSQL (RLS). Session in /api/chat.       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema (Supabase)

Migrations in **`supabase/migrations/`**; apply via CLI (`supabase db push` / `supabase migration up`). No Dashboard-only SQL.

**Tables:**  
`profiles` (id, email, full_name, avatar_url); `interview_sessions` (id, user_id, title); `session_transcripts` (id, session_id, role, content, created_at); `canvas_states` (id, session_id, nodes, edges, viewport — jsonb). Index `(session_id, created_at)` on transcripts. RLS: all scoped by `auth.uid()`; sessions/transcripts/canvas via session ownership. Optional: `handle_new_user()` trigger to create profile on sign-up.

---

## 4. Phase Breakdown

### Phase 0: Bootstrap ✅ Done

**Goal:** Next.js + TypeScript + Tailwind + ESLint + shadcn; folder structure; deps; `.env.example`; `lib/types.ts` (Session, TranscriptEntry, CanvasState).

**Tasks:** (0.1) `pnpm create next-app` (App Router, TS, Tailwind, ESLint). (0.1b) `npx shadcn@latest init`; add Button, Input, Card. (0.2) Folders: app/, components/ui/, lib/, stores/, services/, supabase/migrations/; API under app/api/. (0.3) Deps: @supabase/supabase-js, @supabase/ssr, reactflow, zustand, neverthrow, ts-pattern, ai, @ai-sdk/amazon-bedrock. (0.4) .env.example + .env.local (Supabase URL/keys; AWS/Bedrock server-only, no NEXT_PUBLIC_). (0.5) lib/types.ts stubs.

**Acceptance:** pnpm dev runs; adhere to .cursor/rules; README documents structure and env.

**Deliverables:** Repo scaffold, lib/types.ts.

---

### Phase 1: Auth (GitHub & Google) ✅ Done

**Goal:** Sign in/out; session in app via Supabase SSR.

**Tasks:** (1.1) Supabase: enable GitHub/Google; set callback URL. (1.2) lib/supabase/: createBrowserClient, createServerClient (@supabase/ssr). (1.3) Middleware: refresh session; redirect unauthenticated from /dashboard|/interview to /login. (1.4) app/auth/callback/route.ts: code → session, redirect. (1.5) Login page: shadcn Button for GitHub/Google sign-in and sign-out.

**Acceptance:** Sign in with GitHub/Google → protected page; sign-out works; session in server and client.

**Deliverables:** Auth flow, middleware, login + callback.

**What you need to enable GitHub & Google auth (local Supabase):**

Local Studio has **no** “URL Configuration” or “Providers” UI. Everything is done in **`supabase/config.toml`** (and a **`.env`** in the same project root for secrets). Use the directory where you run `supabase start` (run `supabase init` there if needed).

1. **Redirect URLs and Site URL**  
   In **`supabase/config.toml`** ensure:
   ```toml
   [auth]
   site_url = "http://localhost:3000"
   additional_redirect_urls = ["https://localhost:3000", "http://localhost:3000/auth/callback", "http://127.0.0.1:3000/auth/callback"]
   ```

2. **GitHub OAuth**
   - GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
   - **Authorization callback URL:** `http://127.0.0.1:54321/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**.
   - In the **Supabase project root** (same folder as `supabase/`), create or edit **`.env`** (do not commit):
     ```
     GITHUB_CLIENT_ID=your_github_client_id
     GITHUB_CLIENT_SECRET=your_github_client_secret
     ```
   - In **`supabase/config.toml`** add (or merge into existing `[auth]`):
     ```toml
     [auth.external.github]
     enabled = true
     client_id = "env(GITHUB_CLIENT_ID)"
     secret = "env(GITHUB_CLIENT_SECRET)"
     ```

3. **Google OAuth**
   - Google Cloud Console → APIs & Services → Credentials → **Create credentials → OAuth 2.0 Client ID** (Web application)
   - **Authorized redirect URI:** `http://127.0.0.1:54321/auth/v1/callback`
   - Copy **Client ID** and **Client secret**.
   - Add to the same **`.env`**:
     ```
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     ```
   - In **`supabase/config.toml`** add:
     ```toml
     [auth.external.google]
     enabled = true
     client_id = "env(GOOGLE_CLIENT_ID)"
     secret = "env(GOOGLE_CLIENT_SECRET)"
     skip_nonce_check = false
     ```
   - **Google auth approach:** Same as GitHub: Client ID + Client secret in env; `config.toml` references them via `env(...)`. Supabase docs also allow `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` for the secret; this repo uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` so one set of vars lives in `.env.local` (and is sourced before `supabase start`). In Google Cloud Console, add **Authorized JavaScript origins** (e.g. `http://localhost:3000`) and **Authorized redirect URI** `http://127.0.0.1:54321/auth/v1/callback`.

4. **Env vars:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are in `.env.example`, `.env.local`, `.env.prod`, and `.env.production`. For local Supabase, config.toml reads them from the environment when the CLI starts — run from project root: `source .env.local && supabase start` (or use a `.env` there).

5. **Restart:** `supabase stop` then `supabase start` so changes apply.

*(Hosted projects: use Dashboard → **Authentication** → **URL Configuration** and **Providers** instead of config.toml.)*

---

### Phase 2: Schema & Profile ✅ Done

**Goal:** Migrations applied; RLS; profile on first sign-up.

**Tasks:** (2.1) Migrations for profiles, interview_sessions, session_transcripts, canvas_states + RLS; apply via CLI. (2.2) Profile on sign-up (trigger or callback upsert). (2.3) Typed Supabase client helpers (server + browser). (2.4) Optional: generate DB types into lib/database.types.ts.

**Acceptance:** Migrations apply; RLS blocks cross-user access; profile exists after first login.

**Deliverables:** supabase/migrations/, RLS, profile creation, typed client.

---

### Phase 3: Session CRUD & Data Layer ✅ Done

**Goal:** Create/list/get/delete sessions; append transcript; save/load canvas. Pure lib + services returning Result; API routes.

**Tasks:** (3.1) lib: sessionToPublic, transcriptToPublic, canvasFromDb, mergeTranscript, replaceCanvasState (pure, immutable). (3.2) services/sessions.ts: createSession, listSessions, getSession, deleteSession, appendTranscriptEntry, getTranscript, saveCanvasState, getCanvasState — all return Result<T,E>. (3.3) app/api/sessions/: POST/GET/DELETE sessions; GET/POST transcript; GET/PUT canvas. (3.4) Client hooks/helpers for these APIs.

**Acceptance:** Pure lib unit-testable; API + service coverage for session/transcript/canvas.

**Deliverables:** lib/*.ts (session, transcript, canvas), services/sessions.ts, app/api/sessions/*.

---

### Phase 4: Split-Screen & React Flow ✅ Done

**Goal:** Left: React Flow with AWS-style nodes; right: chat placeholder. Canvas load/save per session.

**Tasks:** (4.1) Layout: left panel (e.g. 50–60%), right panel; resizable optional. (4.2) React Flow in left panel; custom node types (S3, Lambda, API Gateway, etc.); state in Zustand; immutable updates; selectors. (4.3) On session load: fetch canvas → setNodes/setEdges/setViewport. On change (debounced): serialize and PUT /api/sessions/[id]/canvas. (4.4) Right: chat placeholder + session selector / “New session”.

**Acceptance:** Split-screen; React Flow with custom nodes; canvas persists per session.

**Deliverables:** Layout, FlowCanvas, custom nodes, canvas sync.

---

### Phase 5: Chat UI & Transcript ✅ Done

**Goal:** Transcript list + input; useChat targeting /api/chat; canvas (nodes, edges) in request body.

**Tasks:** (5.1) MessageBubble, TranscriptView (shadcn where applicable). (5.2) Transcript in Zustand; fetch for session; append on send; POST /api/sessions/[id]/transcript; handle Result. (5.3) useChat (ai) to /api/chat; pass current nodes/edges in body. (5.4) Transcript load on session select; update after send (refetch or optional realtime).

**Acceptance:** Send message → in transcript; assistant reply after Phase 6.

**Deliverables:** TranscriptView, MessageBubble, ChatInput, useChat + canvas-in-body.

---

### Phase 6: BFF /api/chat (Streaming, Bedrock) ✅ Done

**Goal:** /api/chat: auth (Supabase server client, cookies) → 401 if !session; parse body (messages, nodes, edges); pure parseCanvasState(nodes, edges); streamText (Bedrock) → toDataStreamResponse(). Model: Cross-Region Inference `anthropic.claude-sonnet-4-6`.

**Tasks:** (6.1) app/api/chat/route.ts: Supabase server client; session check → 401; parse body (Zod); stateless. (6.2) lib/canvasParser.ts: parseCanvasState(nodes, edges): string (pure). (6.3) @ai-sdk/amazon-bedrock + streamText; server-only env; return stream.toDataStreamResponse(). (6.4) lib/prompts.ts: system prompt (FAANG interviewer); include parseCanvasState output in context. (6.5) Frontend: useChat + canvas in body (already in Phase 5). (6.6) Optional: persist user+assistant to session_transcripts after stream.

**Acceptance:** Unauthenticated → 401; streamed reply; client never sees AWS; parseCanvasState pure and tested.

**Deliverables:** app/api/chat/route.ts, lib/canvasParser.ts, lib/prompts.ts.

---

### Phase 7: E2E & Polish

**Goal:** New session → draw + chat → leave → resume. Session list; errors and loading handled.

**Tasks:** (7.1) New session: create → navigate to interview/[sessionId]; empty canvas/transcript. (7.2) Resume: list sessions → open by id; load transcript + canvas. (7.3) Auth redirects, loading states, API error handling (toast/inline). (7.4) Optional: session title edit; auto-title from first message. (7.5) README: env, pnpm install / pnpm dev, link to MVP_PLAN.md.

**Acceptance:** Full flow: sign in → new session → chat + draw → resume later; data persists; RLS enforced.

**Deliverables:** Dashboard/session list, new/resume flows, README.

---

## 5. Dependency Graph

```
0 (Bootstrap) → 1 (Auth) → 2 (Schema) → 3 (Session CRUD) ─┐
                                                          ↓
7 (E2E) ← 6 (BFF/chat) ← 5 (Chat UI) ← 4 (Split + Flow) ──┘
```

---

## 6. Testing (Per Phase)

TDD: failing test first, then implement.  
0: manual. 1: manual auth; optional Playwright. 2: migration/RLS checks. 3: unit tests lib; integration for API. 4: component tests layout/Flow; manual save/load. 5: component tests transcript/input; integration send → list. 6: unit parseCanvasState; route 401/stream tests; optional E2E. 7: E2E login → session → chat → resume.

---

## 7. Environment

**.env.local** (gitignored):  
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_KEY`; **server-only** (no NEXT_PUBLIC_): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID` = `anthropic.claude-sonnet-4-6` (Cross-Region Inference).  
Details and key handling: see .cursor/rules (security, BFF).

---

## 8. File Structure (Target)

```
app/api/auth/callback, api/chat (BFF), api/sessions/*  |  app/auth/callback, login, (protected)/dashboard, interview/[sessionId]
components/ui (shadcn), layout/SplitScreen, canvas/FlowCanvas+nodes, chat/*, auth/LoginButtons
lib/types, prompts, session, transcript, canvas, canvasParser, match?, supabase/client+server
stores/sessionStore, canvasStore
services/supabase, sessions
supabase/migrations
middleware, .env.example, .env.local
```

---

## 9. Summary

Eight phases (0–7): bootstrap → auth → schema → session CRUD → split-screen + React Flow → chat UI → BFF /api/chat (streaming, Bedrock hidden) → E2E. All coding rules live in **.cursor/rules/**; schema in **supabase/migrations/**; pnpm only.
