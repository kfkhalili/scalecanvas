# System Design Interview: Three Phases and Prompts

## Goals

1. **Bedrock leads** – The interviewer (Bedrock) initiates the conversation and presents the design problem. The user should see the trainer’s first message before being able to reply.
2. **Phase 1 – Opening** – Trainer states the problem (e.g. “Design a URL shortener”). User is expected to ask clarifying questions (functional/non-functional requirements, scale, etc.) before designing.
3. **Phase 2 – Design** – As the user draws, the trainer is inquisitive: asks about the design, does *not* give hints or suggestions. It’s testing the candidate.
4. **Phase 3 – Conclusion** – Trainer summarizes the interview and gives feedback (what went wrong, e.g. started designing too fast or didn’t ask questions; what went right), like a FAANG debrief.

## Should we use different prompts?

**Yes.** Each phase has different behavior:

- **Phase 1 (Opening)** – Present the problem, set expectations (“ask me clarifying questions”), don’t discuss the design yet.
- **Phase 2 (Design)** – Reference the diagram, ask probing questions, avoid giving ideas or hints.
- **Phase 3 (Conclusion)** – Summarize the conversation and the design, then give structured feedback (what to improve, what was good).

Options:

- **A) Phase in request body** – Frontend or backend sets `phase: "opening" | "design" | "conclusion"`. Backend selects the corresponding system prompt. Phase can be derived from UI (e.g. “End interview” button → conclusion) or heuristics (e.g. diagram empty + few messages → opening; diagram has nodes → design).
- **B) Single prompt with phase instructions** – One long system prompt that describes all three phases and tells the model to infer the current phase from conversation + diagram and behave accordingly. Simpler to wire, but less control and more risk of the model drifting.
- **C) Heuristics only** – No explicit phase; backend infers phase from `messages.length`, diagram empty vs not, and optionally message content (e.g. “I’m done” / “Wrap up”). Then pick the right prompt.

**Recommendation:** Start with **A** and simple heuristics for when to set phase (e.g. no assistant message yet → opening; user said “wrap up” or clicked “End interview” → conclusion; else → design). We can add an explicit “End interview” button later to trigger conclusion.

## Bedrock initiates (trainer speaks first)

Today the chat API requires `messages.length >= 1`. To have the trainer’s message be the first thing the user sees:

**Option 1 – Hidden init message (minimal API change)**  
- When the session has no messages, the frontend sends a single user message that the user never sees, e.g.  
  `"[Start the system design interview. Present the design problem and invite the candidate to ask clarifying questions.]"`  
- Request uses Phase 1 (opening) system prompt.  
- The *assistant* reply is the first visible message.  
- Optionally hide or omit the init user message from the transcript so the UI shows only the trainer’s opening.  
- After the first assistant message, enable the input so the user can reply.

**Option 2 – Allow empty messages for “init”**  
- Extend the API: if `messages` is `[]` and e.g. `init: true` or `phase: "opening"`, treat it as “generate the opening message” and call the model with only the Phase 1 system prompt (no user message).  
- Frontend: when there are no messages, call POST with `{ messages: [], nodes: [], edges: [], init: true }`.  
- Backend returns the streamed opening; frontend appends it as the first assistant message and then enables input.  
- Slightly cleaner semantics (no fake user message) but requires API and client changes.

**Recommendation:** Option 1 is enough: one hidden init user message + Phase 1 prompt. No need to allow `messages: []` in the API.

## Memory: will the agent remember the whole conversation?

**Yes.** Every request to `/api/chat` sends the full `messages` array (and nodes/edges). The backend passes that history into the model. So for the whole session, the model sees:

- All previous user and assistant messages.
- Current diagram (nodes + edges, including labels).

So it can:

- Use the full conversation in Phase 3 to summarize and give feedback.
- Reference earlier answers and the evolving diagram in Phase 2.

We do not need to add special “memory” beyond what we already send. For a typical 30–60 minute interview (dozens of turns), we stay within normal context limits. If we ever hit limits, we could later add summarization of older turns or a “recent N messages + summary of rest” strategy.

## Implementation outline

1. **Prompts** (`lib/prompts.ts`)  
   - Add `getSystemPromptOpening(canvasContext: string)` – present problem, ask for clarifying questions, set expectations.  
   - Add `getSystemPromptDesign(canvasContext: string)` – inquisitive, no hints, reference diagram.  
   - Add `getSystemPromptConclusion(canvasContext: string)` – summarize interview and design, then structured feedback (what to improve, what was good).  
   - Keep a single `getSystemPrompt(canvasContext, phase)` that delegates to the right one, or call the right getter from the route.

2. **API** (`app/api/chat/route.ts`)  
   - Accept optional `phase: "opening" | "design" | "conclusion"` in the body (or infer it; see below).  
   - When `phase === "opening"`, use the opening prompt; when `"design"`, use design; when `"conclusion"`, use conclusion.  
   - Optional: infer phase if not provided (e.g. no assistant messages yet → opening; diagram empty and few messages → opening; else design; conclusion only when explicitly requested).

3. **Init flow (trainer speaks first)**  
   - When `initialEntries.length === 0`, don’t show “No messages yet. Send a message to start.” Instead show e.g. “Starting interview…” and automatically send one user message (hidden from transcript), e.g. “Start the system design interview. Present the design problem and invite me to ask clarifying questions.” with `phase: "opening"`.  
   - When the first assistant message is received, append it to the transcript and enable the input. Optionally do not append the init user message to the visible transcript (or show it as a system line like “Interview started.”).  
   - Disable the send input until the first assistant message has been received (so the user cannot type before the trainer has spoken).

4. **Conclusion phase**  
   - Add an “End interview” (or “Wrap up”) action in the UI. When the user clicks it, the next request is sent with `phase: "conclusion"` and optionally a user message like “Please summarize the interview and give me feedback.”  
   - Alternatively, the user can type “I’m done” or “Wrap up” and we could detect that and set `phase: "conclusion"` on the next request (weaker UX).

5. **Design phase default**  
   - For normal user messages after the opening (and when not wrapping up), send `phase: "design"` so the trainer stays in “inquisitive, no hints” mode.

This gives you three distinct prompts, Bedrock leading with the opening, and full-conversation memory for the conclusion and feedback.
