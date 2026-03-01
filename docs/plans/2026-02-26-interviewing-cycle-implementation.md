# Interviewing Cycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the adjusted interviewing cycle: two beginning paths (anonymous → trial vs signed-in token), phase-based process with hints/notes/stray→terminate, and secure one-time time-expired conclusion via a dedicated endpoint.

**Architecture:** Single topic list (27 topics) with two variants per topic. **Beginning has two entry paths:** (A) **Anonymous (never signed in)** — comprehensive prompt only, no Bedrock; on **first sign-in only**, handoff creates a trial and must carry over topic, chat, and canvas (see "Lessons learned" below). Trial is one-time per user. (B) **Signed-in with token** — Bedrock speaks first using conversational prompt; 60 min. Trial is the continuation of path A after first sign-in (15 min). Phase-specific prompts in `/api/chat` (opening, design, conclusion voluntary). New POST `/api/sessions/[id]/conclusion` for time-expired summary only; server validates elapsed ≥ limit and at-most-once per session, then streams Bedrock response and persists summary. No canvas lock after expiry.

**Tech Stack:** Next.js App Router, Supabase (auth + sessions), Effect, Vercel AI SDK + Amazon Bedrock, Zustand. See design: `docs/plans/2026-02-26-interviewing-cycle-design.md`.

---

## Prerequisites

- Design doc read and approved: `docs/plans/2026-02-26-interviewing-cycle-design.md`.
- Existing: `lib/questions.ts`, `lib/prompts.ts`, `lib/chatGuardrails.ts`, `app/api/chat/route.ts`, `stores/authHandoffStore`, `components/chat/ChatPanel.tsx`, `services/sessions.ts`.

---

## Lessons learned (anonymous handoff — implemented)

When changing handoff or session-load behavior, preserve the following (design Section 1.7):

- **Single anonymous workspace:** Canvas and chat are persisted in one localStorage key (`stores/anonymousWorkspaceStorage.ts`). Rehydrate with `loadAnonymousWorkspace()` before reading state for handoff (e.g. in the effect that runs `runBffHandoff`), so `getCanvasState()` has nodes/edges.
- **Skip fetch when handoff pending:** On the session page, when `pendingSessionId === sessionId`, do not fetch canvas or transcript from the API; use in-memory canvas and `anonymousMessages` for transcript. Otherwise the first fetch can return empty and overwrite the carried-over state.
- **Canvas API:** `PUT /api/sessions/[id]/canvas` verifies session ownership; client may retry once on failure. E2E: assert on the first PUT request body (e.g. `nodes.length > 0`), not only UI after reload.

---

### Task 1: Add topic list with two variants (data only)

**Files:**
- Modify: `lib/questions.ts` (replace or extend QUESTION_BANK)

**Step 1: Define type and 27 topics**

Add or replace with: type `InterviewTopic` with `id`, `title`, `difficulty: 'easy' | 'medium' | 'hard'`, `comprehensivePrompt: string`, `conversationalPrompt: string`. Add all 27 topics from design Section 1.6 (Bit.ly, Dropbox, … Payment System) with both prompts. Keep `getRandomQuestion` or rename to `getRandomTopic()` returning one topic. Ensure no duplicate ids.

**Step 2: Add tests**

Test: `lib/questions.test.ts` (or extend existing). Test: `getRandomTopic()` returns a topic with both prompts; test that all 27 ids are present and each has non-empty `comprehensivePrompt` and `conversationalPrompt`.

**Step 3: Run tests**

Run: `pnpm test -- lib/questions`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/questions.ts lib/questions.test.ts
git commit -m "feat(questions): 27 topics with comprehensive and conversational prompts"
```

---

### Task 2: DB migration for conclusion summary

**Files:**
- Create: `supabase/migrations/<birth>_add_conclusion_summary.sql`

**Step 1: Create migration file**

Use timestamp from `stat -f '%SB' -t '%Y%m%d%H%M%S'` on the new file after creating. Add column to `public.interview_sessions`: `conclusion_summary text null`. Comment: "Final summary from time-expired or voluntary conclusion; set once per session."

**Step 2: Run migration locally (if applicable)**

Run: `pnpm supabase db push` or equivalent.
Expected: Migration applied.

**Step 3: Commit**

```bash
git add supabase/migrations/*_add_conclusion_summary.sql
git commit -m "feat(db): add conclusion_summary to interview_sessions"
```

---

### Task 3: Session service — read/write conclusion_summary

**Files:**
- Modify: `services/sessions.ts`
- Modify: `lib/types.ts` (if Session type is there)
- Test: `services/sessions.test.ts`

**Step 1: Extend Session type**

Ensure `Session` includes `conclusionSummary: string | null` (or equivalent from DB column name). Update any `sessionFromRow` or mapper to include it.

**Step 2: Add setConclusionSummary (or extend updateSession)**

Add function or extend `updateSession` to set `conclusion_summary` for a session by id (and user_id check if done in service). Pure Effect; no side effects beyond DB.

**Step 3: Write failing test**

Test: when updating conclusion summary, the session row has `conclusion_summary` set; test that fetching session returns it.

**Step 4: Run test**

Run: `pnpm test -- services/sessions`
Expected: FAIL then implement, then PASS

**Step 5: Commit**

```bash
git add services/sessions.ts lib/types.ts services/sessions.test.ts
git commit -m "feat(sessions): add conclusion_summary read/write"
```

---

### Task 4: Conclusion endpoint — validation only (no Bedrock yet)

**Files:**
- Create: `app/api/sessions/[id]/conclusion/route.ts`
- Test: `app/api/sessions/[id]/conclusion/route.test.ts` or integration test

**Step 1: Write failing test**

Test: POST with valid auth and session that is expired and has no conclusion_summary → 200 or stream (we'll add stream later). Test: POST when elapsed < limit → 403. Test: POST when conclusion_summary already set → 403. Test: POST with wrong user → 403. Test: no auth → 401.

**Step 2: Implement route (validation only)**

Parse body (messages, nodes, edges). Get auth (Supabase server client). Get session by id; verify ownership. Compute elapsed; get limit from `lib/chatGuardrails.timeLimitForSession(session)`. If elapsed < limit return 403 "Time has not expired. You cannot request the final summary yet." If session.conclusionSummary (or equivalent) already set return 403 "Final summary was already generated for this session." Otherwise return 200 with placeholder body (e.g. `{ ok: true }`) for now.

**Step 3: Run tests**

Run: `pnpm test -- app/api/sessions`
Expected: PASS

**Step 4: Commit**

```bash
git add app/api/sessions/\[id\]/conclusion/route.ts app/api/sessions/\[id\]/conclusion/route.test.ts
git commit -m "feat(api): POST /api/sessions/[id]/conclusion validation"
```

---

### Task 5: Conclusion endpoint — Bedrock call and persist

**Files:**
- Modify: `app/api/sessions/[id]/conclusion/route.ts`
- Modify: `lib/prompts.ts` (add getSystemPromptConclusionTimeExpired or equivalent)

**Step 1: Add conclusion prompt**

In `lib/prompts.ts` add a function that returns the system prompt for time-expired conclusion (summary: what went well, what didn't, areas to improve, resources). Include instruction that this is the final message.

**Step 2: Call Bedrock and stream**

After validation, build messages from body; build canvas context from nodes/edges via `parseCanvasState`. Call Bedrock streamText with conclusion prompt and full messages + canvas. Stream response back (same pattern as `/api/chat`: toDataStreamResponse). Do not persist yet.

**Step 3: Persist summary after stream**

After stream completes, collect full assistant text (or use onFinish callback pattern), then call session service to set `conclusion_summary`. Handle race: if two requests slip through, only first persist wins (or use DB constraint). Ensure we only set once.

**Step 4: Manual test**

Run app; create session; wait or mock time to expiry; POST to conclusion with messages/nodes/edges; verify 403 when not expired, 200 + stream when expired, and conclusion_summary set in DB after.

**Step 5: Commit**

```bash
git add app/api/sessions/\[id\]/conclusion/route.ts lib/prompts.ts
git commit -m "feat(api): conclusion endpoint streams Bedrock and persists summary"
```

---

### Task 6: Phase-specific prompts (opening, design, conclusion voluntary)

**Files:**
- Modify: `lib/prompts.ts`
- Modify: `app/api/chat/route.ts`

**Step 1: Add getSystemPromptOpening(problemText), getSystemPromptDesign(), getSystemPromptConclusion()**

Opening: present problem, invite clarifying questions. Design: reference diagram and notes; may give hints and challenge; assess user's questions; if user strays purposefully, warn once then call terminate_interview. Conclusion (voluntary): summarize interview and design, structured feedback. Keep existing security rule (abuse → terminate immediately). Add one line in design prompt: candidate may have note nodes on the canvas; use them when evaluating.

**Step 2: Chat route accepts phase**

Parse optional `phase: 'opening' | 'design' | 'conclusion'` from body. Select prompt by phase. For opening, accept optional problem text or topic id and inject into prompt (conversational variant for token sessions).

**Step 3: Tests**

Unit test prompts (no Bedrock): e.g. prompt contains "clarifying" for opening; contains "terminate" for design; conclusion contains "feedback". Chat route test: when phase is opening, correct prompt is used (mock or snapshot).

**Step 4: Commit**

```bash
git add lib/prompts.ts app/api/chat/route.ts
git commit -m "feat(prompts): phase-specific opening, design, conclusion"
```

---

### Task 7: Beginning — anonymous path (path A) uses comprehensive only — never signed in

**Note:** Path A is for users who have **never signed in**; they get a trial **only on first sign-in**. Anonymous handoff (topic + chat + canvas carryover to trial) is already implemented; see "Lessons learned" and design Section 1.7. Do not regress rehydrate-before-handoff or skip-fetch-when-pending behavior.

**Files:**
- Modify: `components/chat/ChatPanel.tsx`
- Modify: `stores/authHandoffStore.ts` (if we store topic id)
- Modify: `lib/questions.ts` usage

**Step 1: Anonymous first message from comprehensive prompt**

When anonymous and messages.length === 0 (and no active question), pick topic via getRandomTopic(); set first message to topic.comprehensivePrompt. Set questionTitle to topic.title for handoff. Remove or replace previous getRandomQuestion() usage for anonymous path.

**Step 2: Handoff sends topic title**

Ensure handoff API still receives question_title (topic title) so trial session can show same topic. No change if already using questionTitle.

**Step 3: Manual test**

Load app logged out; see one comprehensive-style message; draw; sign in; verify trial has same topic and 15 min.

**Step 4: Commit**

```bash
git add components/chat/ChatPanel.tsx stores/authHandoffStore.ts lib/questions.ts
git commit -m "feat(anonymous): use comprehensive prompt from topic list"
```

---

### Task 8: Beginning — signed-in token path (path B) uses conversational + Bedrock opening

**Files:**
- Modify: `components/chat/ChatPanel.tsx`
- Modify: `app/api/chat/route.ts` (opening init)

**Step 1: New session with empty transcript**

When signed-in and sessionId present and initialEntries.length === 0 (and not from handoff), pick topic via getRandomTopic(). Don't set messages locally with conversational prompt; instead trigger init request to /api/chat with phase: 'opening' and problem text = topic.conversationalPrompt (or topic id so backend can look up). Backend: when phase === opening and no user message (or hidden init message), use getSystemPromptOpening(problemText) and optionally inject problem as first assistant turn. Frontend: send init, receive streamed opening, append to messages, enable input.

**Step 2: Ensure only one opening**

After first assistant message, subsequent requests use phase: 'design'. Heuristic or explicit: if transcript has at least one assistant message, use design prompt.

**Step 3: Manual test**

Create new session (token); see Bedrock speak first with conversational opener; reply and see design-phase behavior.

**Step 4: Commit**

```bash
git add components/chat/ChatPanel.tsx app/api/chat/route.ts
git commit -m "feat(signed-in): Bedrock opening with conversational prompt for new sessions"
```

---

### Task 9: Trial (post-handoff) — same topic, design phase

**Files:**
- Modify: `components/chat/ChatPanel.tsx` or handoff flow
- Optional: add short "You have 15 minutes" message when loading trial session

**Step 1: Trial session first Bedrock turn**

When loading a trial session (is_trial) with existing transcript (from handoff), do not send opening again. First user message uses phase: 'design'. Optionally prepend a system or assistant message "You have 15 minutes. Ask clarifying questions and work through your design." (can be client-side or one Bedrock call with minimal prompt). Prefer minimal: just proceed to design on first user message.

**Step 2: Commit**

```bash
git add components/chat/ChatPanel.tsx
git commit -m "feat(trial): design phase from first message after handoff"
```

---

### Task 10: Frontend — call conclusion endpoint when countdown hits 0

**Files:**
- Modify: component that shows countdown (e.g. timer or session bar)
- Modify: `components/chat/ChatPanel.tsx` or where useChat lives
- Possibly: `stores/sessionStore.ts` or new effect

**Step 1: When remainingMs <= 0**

When countdown reaches 0 (or on next tick after), if not already requested for this session, POST to `/api/sessions/[sessionId]/conclusion` with body: { messages, nodes, edges } (same shape as chat). Use fetch with credentials; handle stream (same as useChat stream consumption). Append streamed assistant message to transcript (or dedicated "summary" state). Set a ref or flag "conclusionRequested" so we never send again. On 403, show error toast (e.g. "Time has not expired" or "Summary already generated").

**Step 2: Show summary**

Display the streamed conclusion in the transcript area. Optionally persist to transcript store so it's part of the session. If we persisted on server, on reload we could show conclusion_summary from session instead of re-calling (optional).

**Step 3: Disable further conclusion requests**

After one successful conclusion response, disable any "request summary" button or automatic retry. One request per session enforced by client too (ref).

**Step 4: Manual test**

Start session; advance system time or wait; at 0:00 verify one POST to conclusion, streamed summary appears, second POST returns 403.

**Step 5: Commit**

```bash
git add <timer/chat components>
git commit -m "feat(frontend): request time-expired conclusion at countdown 0"
```

---

### Task 11: Voluntary conclusion — "End interview" button

**Files:**
- Modify: Chat UI (e.g. TranscriptView or ChatPanel)
- Modify: `app/api/chat/route.ts` (already has phase conclusion)

**Step 1: Add "End interview" button**

Button visible when session is active. On click: send request to /api/chat with phase: 'conclusion', user message e.g. "Please summarize the interview and give me feedback." Backend uses getSystemPromptConclusion(); Bedrock responds and may call terminate_interview. Frontend appends response; then disable chat (setSessionActive(false) on tool call or on response).

**Step 2: Handle 403 / terminated**

If session is already terminated or expired, button disabled or hidden. After voluntary end, same as terminate flow: toast, disable input.

**Step 3: Commit**

```bash
git add components/chat/ChatPanel.tsx <button location>
git commit -m "feat(ui): End interview button for voluntary conclusion"
```

---

### Task 12: Docs and cleanup

**Files:**
- Modify: `docs/INTERVIEW_PHASES.md`
- Optional: README or docs update

**Step 1: Update INTERVIEW_PHASES.md**

Align with new flow: beginning (anonymous vs token vs trial), process (phases, notes, hints, stray→terminate), conclusion (voluntary vs time-expired, dedicated endpoint). Reference design doc.

**Step 2: Commit**

```bash
git add docs/INTERVIEW_PHASES.md
git commit -m "docs: update INTERVIEW_PHASES for new cycle"
```

---

## Execution

Plan complete. Use **superpowers:executing-plans** to run task-by-task, or **superpowers:subagent-driven-development** for subagent per task with review.

**Two execution options:**

1. **Subagent-Driven (this session)** — Dispatch fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.

Which approach?
