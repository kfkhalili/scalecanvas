# Interviewing Cycle: Beginning, Process, Conclusion — Design

**Status:** Draft → Approved (after section sign-off)  
**Approach:** Dedicated conclusion endpoint (POST `/api/sessions/[id]/conclusion`); single topic list with two variants per topic; server-enforced one-time time-expired summary.

---

## Goals

1. **Beginning** — Different experience for anonymous vs signed-in: anonymous gets a comprehensive question (scale, concurrency) to kickstart PLG; signed-in token sessions get a conversational open-ended opener. Trial (post-handoff) keeps the same topic, 15 min.
2. **Process** — Signed-in only; interviewer assesses questions, uses canvas notes, can give hints or challenge; stray purposefully → warn then terminate.
3. **Conclusion** — Two paths: (a) voluntary (interviewer satisfied or user ends) → final feedback then terminate; (b) time expired → one final Bedrock summary (what went well, what didn’t, resources), client-triggered, server-validated, once per session. Canvas not locked after expiry.

---

## Section 1: Beginning (who sees what, question bank)

### 1.1 Topic list and variants

- **Single source of truth:** One list of 27 topics with difficulty (Easy / Medium / Hard) in `lib/questions.ts` (or `lib/interviewTopics.ts`).
- **Two variants per topic:**
  - **Comprehensive:** For anonymous (and trial handoff). Includes scale and constraints (e.g. DAU, read/write ratio, retention, concurrency) so the user can start designing without talking to Bedrock. Field: `comprehensivePrompt` per topic.
  - **Conversational:** For signed-in token-created sessions. Short, inviting opener (e.g. “I’d like you to design a URL shortener like Bit.ly. Ask me any clarifying questions about scale or requirements before you start.”). Field: `conversationalPrompt` per topic.
- **Selection:** Random for now. Topic chosen at session start; no topic-selection UI in this phase.

### 1.2 Anonymous flow

- Anonymous user lands (no session). Pick a **random topic** and show the **comprehensive** variant as the first (and only) “message” — no Bedrock. User can draw; typing or Evaluate → existing PLG flow (teaser + sign-in). On sign-in, handoff creates a **trial session** with that topic; opening message already shown (or re-injected); **15-minute** timer applies.

### 1.3 Signed-in, token-created session (New session)

- User creates a session via token (“New session”). Pick a **random topic** and show the **conversational** variant as the opening. Opening is produced by **Bedrock** (trainer speaks first): frontend sends an init request to `/api/chat` with `phase: "opening"` and the chosen topic (or problem text); backend uses the **conversational** prompt for that topic in the opening system prompt. User sees one conversational opener; **60-minute** limit for paid sessions.

### 1.4 Trial session after handoff

- After handoff, session is trial (15 min). Problem is the same topic the anonymous user saw (comprehensive variant already shown). First Bedrock turn can restate “You have 15 minutes. Ask clarifying questions and work through your design.” or proceed to **design** phase with full transcript + canvas. Design phase uses full context (transcript + canvas, including notes).

### 1.5 Summary table

| Context                    | Opening content              | Who produces it   | Time limit   |
|----------------------------|------------------------------|-------------------|--------------|
| Anonymous                  | Comprehensive (one topic)    | Static / no LLM   | N/A          |
| Trial (post-handoff)       | Same topic, already shown     | Bedrock (design)  | 15 min       |
| Token-created (New session)| Conversational (one topic)   | Bedrock (opening) | 60 min       |

### 1.6 Topic list (27 topics, two variants each)

- **Easy:** Bit.ly, Dropbox, Local Delivery Service, News Aggregator  
- **Medium:** Ticketmaster, FB News Feed, Tinder, LeetCode, WhatsApp, Yelp, Strava, Rate Limiter, Online Auction, FB Live Comments, FB Post Search, Price Tracking Service  
- **Hard:** Instagram, YouTube Top K, Uber, Robinhood, Google Docs, Distributed Cache, YouTube, Job Scheduler, Web Crawler, Ad Click Aggregator, Payment System  

Each topic has `comprehensivePrompt` and `conversationalPrompt`; difficulty stored for future filtering/selection.

---

## Section 2: Process (signed-in only)

- **Only signed-in users** interact with Bedrock; anonymous do not call `/api/chat`.
- **Phases:** Opening (problem + invite clarifying questions), Design (main loop), Conclusion (final feedback or time-expired summary). Backend selects system prompt by `phase` in request body (or inferred).
- **Design-phase behavior:** Interviewer assesses the kind of questions the user asks as they narrow the problem space. User is told they can write **notes on the canvas**; those nodes (and the rest of the diagram) are included in every request via `parseCanvasState(nodes, edges)` and optionally called out in the system prompt (“Candidate may have added note nodes; use them when evaluating.”). Interviewer may **give hints** or **challenge** aspects of the design; keeps user on track toward a satisfactory system design before the end of the session.
- **Straying purposefully:** If the user strays off-topic (e.g. refuses to stay on system design), the interviewer is instructed to **warn once** and then, if they continue, call the **`terminate_interview`** tool to end the session immediately. Existing tool and prompt rule for abuse/prompt-injection remain; add instruction for “stray on purpose → warn then terminate.”
- **Canvas notes:** Existing canvas state (nodes + edges, including text/notes nodes) is already sent in the chat body; ensure `parseCanvasState` includes all node labels so notes are in LLM context. No new API; optionally add one sentence in the design-phase prompt that notes on the canvas are the candidate’s and should be considered when evaluating.

---

## Section 3: Conclusion

### 3.1 Voluntary conclusion (user or interviewer satisfied)

- User can click **“End interview”** (or similar). Frontend sends a request to `/api/chat` with `phase: "conclusion"` and optional user message (“Please summarize and give feedback.”). Backend uses **conclusion** system prompt; Bedrock gives final feedback and may call **`terminate_interview`** (or we rely on UI state “interview ended”). Session status can become `terminated` or stay `active` with no further chat allowed from UI.
- If the **interviewer** (Bedrock) is satisfied and has nothing to add, the model gives one last feedback and then calls `terminate_interview` per prompt instructions.

### 3.2 Time-expired conclusion (one-time summary)

- **Trigger:** When the frontend **countdown hits 0** (trial 15 min or paid 60 min), the client sends **one** request to a **dedicated endpoint** (not `/api/chat`): **POST `/api/sessions/[id]/conclusion`**.
- **Body:** Same shape as chat for context: `{ messages, nodes, edges }` (full transcript + canvas so Bedrock has latest state).
- **Server rules (no client trust):**
  1. Auth: user must be session owner (same as chat).
  2. **Elapsed ≥ limit:** `elapsed = now - session.createdAt`; limit = 15 min (trial) or 60 min (paid). If `elapsed < limit` → **403** “Time has not expired. You cannot request the final summary yet.” (prevents cheating by sending conclusion early.)
  3. **At most one conclusion per session:** Persist a conclusion record (e.g. `conclusion_summary` text or `conclusion_generated_at` on the session). If already set → **403** “Final summary was already generated for this session.” (Prevents re-triggering with updated canvas after expiry; canvas is not locked.)
  4. Optional **grace window:** Allow request if `elapsed` is within `limit` to `limit + 2 min`; beyond that, reject. Prevents abuse of very old sessions.
- **Flow:** Validate → call Bedrock once with conclusion prompt + provided messages/nodes/edges → stream response to client → persist summary (e.g. in DB) so reopening the session shows the same summary without calling Bedrock again.
- **Canvas:** We do **not** lock the canvas after expiry; the one-time check ensures the user cannot get multiple “final summaries” by editing and re-requesting.

### 3.3 Conclusion prompt content

- **Voluntary:** Summarize the interview and design; structured feedback (what to improve, what was good); then end (tool or implicit).
- **Time-expired:** Final summary: what the user did well, what they didn’t, areas to improve, resources to read, so they can be better prepared next time.

---

## Section 4: Data & API

### 4.1 Question bank data

- **Location:** `lib/questions.ts` or `lib/interviewTopics.ts`.
- **Shape per topic:** `id`, `title`, `difficulty` (easy | medium | hard), `comprehensivePrompt`, `conversationalPrompt`. Optional: `hints[]` for anonymous/trial if we keep hint UI.
- **Selection:** `getRandomTopic()` (and optionally `getTopicById(id)`). No filtering by difficulty in v1; random over all 27.

### 4.2 Session and conclusion persistence

- **Sessions:** Existing `interview_sessions` (e.g. `id`, `user_id`, `status`, `is_trial`, `created_at`, `title`). Add:
  - **`conclusion_summary`** (text, nullable): stores the time-expired (or voluntary) final summary so it can be shown on reopen without calling Bedrock again. Or **`conclusion_generated_at`** (timestamptz, nullable) to mean “conclusion was generated”; summary could be stored elsewhere (e.g. last assistant message in transcript). Simplest: **`conclusion_summary`** text column; set when we generate the one-time conclusion.
- **Topic on session (optional):** If we want to “fix” the topic for a session (e.g. for handoff we already have `question_title`); we could add `topic_id` or keep deriving from title. For handoff, current `question_title` can remain; for new sessions we can store topic id or title when we set the opening.

### 4.3 API surface

- **POST `/api/chat`** (existing): Body includes `session_id`, `messages`, `nodes`, `edges`, and optional **`phase`** (`opening` | `design` | `conclusion`) and optional **opening problem** (topic id or conversational prompt text) for init. When `phase === "conclusion"` and voluntary end, use conclusion prompt; **do not** allow `conclusion_reason: "time_expired"` here — that path is only via the new endpoint.
- **POST `/api/sessions/[id]/conclusion`** (new): Body: `{ messages, nodes, edges }`. Auth + ownership; elapsed ≥ limit; conclusion not yet generated; then one Bedrock call, stream response, persist `conclusion_summary` (and optionally append to transcript). Returns streamed response (same as chat) or 403 with clear error message.

### 4.4 Frontend

- **Anonymous:** On load, pick random topic; set first “message” to `comprehensivePrompt`; no `/api/chat`. Persist `questionTitle` (or topic id) for handoff.
- **Token-created session:** On new session with empty transcript, pick random topic; send init to `/api/chat` with `phase: "opening"` and topic/conversational prompt so Bedrock speaks first.
- **Trial (post-handoff):** Load session with existing transcript (and optional “You have 15 minutes…” message); from next user message, use `phase: "design"`.
- **Countdown hit 0:** Call **POST `/api/sessions/[id]/conclusion`** with current `messages`, `nodes`, `edges`; display streamed summary; then disable further conclusion requests (and optionally show stored summary on revisit).
- **“End interview” button:** Send to `/api/chat` with `phase: "conclusion"` (voluntary); show final message; disable chat when session is terminated or ended.

---

## Section 5: Security

- **Conclusion endpoint:** Same auth as chat (Supabase server client, session from cookies). Require `session_id` in path; fetch session; verify `session.user_id === auth.uid()`. Reject if not owner, session not found, or session already terminated.
- **Time-expired cheat prevention:** Only allow generating the time-expired summary when `elapsed >= timeLimitForSession(session)`. Reject with 403 if `elapsed < limit`. No trust of client-supplied “time_expired” beyond the request intent; server computes elapsed from `session.createdAt`.
- **One-time per session:** After successfully generating and persisting the conclusion, set `conclusion_summary` (or `conclusion_generated_at`). Any subsequent POST to `/api/sessions/[id]/conclusion` for that session returns 403 “Final summary was already generated.”
- **Existing chat guardrails:** 401/403 for unauthenticated, wrong user, terminated session, or expired time remain. `terminate_interview` tool and prompt rule unchanged; add “warn then terminate” for purposeful straying in the design-phase prompt.

---

## Implementation order (high level)

1. **Topic list:** Add 27 topics with `comprehensivePrompt` and `conversationalPrompt`; keep difficulty; random selection.
2. **Beginning:** Anonymous uses comprehensive variant only; token-created uses conversational + Bedrock opening (phase + init); trial keeps same topic, 15 min, design phase.
3. **Prompts:** Phase-specific prompts (opening, design, conclusion); design allows hints and challenges; note about canvas notes; stray → warn then terminate.
4. **Conclusion endpoint:** POST `/api/sessions/[id]/conclusion`; validation (elapsed, one-time); Bedrock call; persist summary; stream response.
5. **DB:** Add `conclusion_summary` (or equivalent) to sessions; migration.
6. **Frontend:** Init flow for token sessions; “End interview”; on countdown 0 call conclusion endpoint; show summary and prevent duplicate requests.

---

## References

- `docs/INTERVIEW_PHASES.md` — existing phase and init ideas  
- `lib/prompts.ts` — current single prompt  
- `lib/chatGuardrails.ts` — `TRIAL_TIME_LIMIT_MS`, `PAID_TIME_LIMIT_MS`, `getSessionIfWithinTimeLimit`  
- `docs/plans/2026-02-21-session-guardrails-kill-switch-design.md` — terminate tool and status  
- `lib/questions.ts` — current QUESTION_BANK (to be replaced or extended with two variants)
