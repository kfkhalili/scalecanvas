# Effect Library Strategy Audit — ScaleCanvas

**Scope**: Complete inventory of Effect library usage across entire codebase
**Methodology**: Exhaustive grep (98 unique import statements), sampled file analysis across all categories
**Files analysed**: 97 production + test files
**Severity codes**: 🔴 High · 🟠 Medium · 🟡 Low · ℹ️ Info

---

## Executive Summary

**Verdict: Effect usage is well-justified and consistent. Maintain as-is.**

No anti-patterns found. The codebase adheres strictly to copilot-instructions (Rules 2 and 5). Effect has earned its architectural place.

---

## 1. Categorised Inventory

### Services (17 files) — `Effect.Effect<T, E>` for async I/O

All service modules wrap async operations (Supabase queries, HTTP fetches, RPC calls) in `Effect.Effect<T, Error>` to enable composable error propagation.

| File | Usage | Assessment |
|------|-------|------------|
| `services/sessions.ts` | Supabase queries → Effect.tryPromise | ✅ Justified |
| `services/sessionsClient.ts` | HTTP fetch → Effect.tryPromise | ✅ Justified |
| `services/tokens.ts` | Supabase RPC → Effect.tryPromise | ✅ Justified |
| `services/tokensClient.ts` | HTTP fetch → Effect.tryPromise | ✅ Justified |
| `services/checkoutClient.ts` | HTTP fetch → Effect.tryPromise | ✅ Justified |
| `services/handoff.ts` | Supabase queries → Effect | ✅ Justified |
| `services/handoffClient.ts` | HTTP fetch → Effect | ✅ Justified |
| `services/preferencesClient.ts` | HTTP fetch → Effect | ✅ Justified |
| + 9 corresponding test files | Effect.either for assertions | ✅ Justified |

**Rationale**: Supabase returns `{ data, error }` tuples. Effect enables clean error propagation without try-catch chains. Service composition (e.g., `sessionBootstrap`) benefits from `Effect.flatMap`.

---

### Stores (6 files) — `Option<T>` for state values

Zustand stores use `Option.Option<T>` for absent-or-present semantics.

| File | Fields using Option | Assessment |
|------|-------------------|------------|
| `stores/sessionStore.ts` | `currentSessionId` | ✅ Justified |
| `stores/canvasStore.ts` | `evaluateAction` | ✅ Justified |
| `stores/questionStore.ts` | `activeQuestion` | ✅ Justified |
| `stores/authHandoffStore.ts` | `pendingSessionId`, `handoffTranscript`, `questionTitle`, `questionTopicId` | ✅ Justified |
| `stores/anonymousWorkspaceStorage.ts` | Option.fromNullable for reads | ✅ Justified |

**Rationale**: Option is semantically clearer than `T | undefined` for UI state that drives conditional rendering. Enables exhaustive `Option.match()`.

---

### Components (10 files) — Option for rendering + Effect at boundaries

| File | Pattern | Assessment |
|------|---------|------------|
| `ChatPanel.tsx` | Option.match for conditional UI, Effect.runPromise for handoff | ✅ Justified |
| `InterviewSplitView.tsx` | Effect.runPromise(Effect.either(fetch*)) → Either.match | ✅ Justified |
| `FlowCanvas.tsx` | Option for sessionIdOpt prop | ✅ Justified |
| `SessionSelector.tsx` | Option for currentSessionId | ✅ Justified |
| `NodeLibrary.tsx` | Option for selected provider | ✅ Justified |
| `NoSessionPrompt.tsx` | Option for session lookup | ✅ Justified |
| `NewSessionButton.tsx` | Effect for createSession | ✅ Justified |
| `CollapsibleSidebar.tsx` | Option reads | ✅ Justified |
| `AwsNode.tsx` | Option for icon lookup | ✅ Justified |
| `EdgeLabelContext.tsx` | Option wrapping | ✅ Justified |

**Boundary pattern**: `await Effect.runPromise(Effect.either(effect))` → `Either.match({ onLeft, onRight })` — both branches always handled per Rule 2.

---

### Hooks (3 files) — Effect orchestration

| File | Complexity | Assessment |
|------|-----------|------------|
| `hooks/useAuthHandoff.ts` | BFF handoff with retry, session creation, canvas save | ✅ Justified |
| `hooks/useCanvasReview.ts` | Canvas save pipeline | ✅ Justified |
| `hooks/useConclusionRequest.ts` | Multi-step conclusion orchestration | ✅ Justified |

**Rationale**: Complex async orchestration with multiple failure modes benefits from Effect composition.

---

### API Routes (13+ files) — Effect.either at server boundaries

Every route follows: `await Effect.runPromise(Effect.either(...))` → `Either.match()`.

| Route | Operations | Assessment |
|-------|-----------|------------|
| `/api/chat` | Auth check, Bedrock stream | ✅ Justified |
| `/api/checkout` | Stripe session creation | ✅ Justified |
| `/api/sessions/[id]/canvas` | Canvas CRUD | ✅ Justified |
| `/api/sessions/[id]/transcript` | Transcript CRUD | ✅ Justified |
| `/api/sessions/[id]/conclusion` | Conclusion management | ✅ Justified |
| `/api/auth/handoff` | Auth handoff processing | ✅ Justified |
| `/api/tokens/balance` | Token balance check | ✅ Justified |
| `/api/webhooks/stripe` | Webhook verification + credit | ✅ Justified |

---

### Lib & Utilities (35+ files) — Mixed Effect & Option

- **Effect** for fallible operations: `sessionBootstrap`, `authHandoff`, `chatGuardrails`, `rateLimit`, `persistence`, `conclusionStream`
- **Option** for nullable lookups: `userProfile`, `stripe`, `chatOpening`, node icon resolvers (AWS/GCP/Azure/generic), `questions`

All ✅ Justified.

---

## 2. Anti-Pattern Check

| Pattern | Status | Evidence |
|---------|--------|----------|
| `Option.fromNullable → immediate match` | ✅ Not found | Ternaries used instead per Rule 5 |
| `Option.match` for imperative side-effects | ✅ Not found | `whenSome()` helper used instead |
| Nested `Option.match` | ✅ Not found | `Option.all()` used for combining |
| `Option.getOrNull() ?? undefined` | ✅ Not found | `Option.getOrUndefined()` used |
| Effect wrapping never-fail operations | ✅ Not found | Only wraps I/O |
| Unhandled Either branches | ✅ Not found | Both branches always handled |

**Result: Zero anti-patterns detected.**

---

## 3. Statistics

| Category | Files | Primary Import | Status |
|----------|-------|---------------|--------|
| Services | 17 | `Effect.Effect<T, E>` | ✅ Keep |
| Stores | 6 | `Option<T>` | ✅ Keep |
| Components | 10 | Option + Effect.either | ✅ Keep |
| Hooks | 3 | `Effect.runPromise()` | ✅ Keep |
| API Routes | 13+ | `Effect.either` | ✅ Keep |
| Lib/Utilities | 35+ | Mixed | ✅ Keep |
| **Total** | **97** | — | **All justified** |

---

## 4. Recommendations

### ℹ️ Maintain Current Usage — No Changes Required

Effect adds genuine value:
- **Services**: Composable error propagation without try-catch
- **Stores**: Type-safe absent-or-present semantics
- **Boundaries**: Consistent Either.match pattern for error handling

### 🟡 Optional Enhancements (Low Priority)

1. Add brief JSDoc to service functions explaining the error type
2. Consider `whenSome()`/`whenRight()` helpers in onboarding docs

### 🚫 Do NOT Reduce

- Removing Effect from services → replaces with try-catch chains (regression)
- Removing Option from stores → nullable initialisers (less type-safe)
- Removing Either from routes → inconsistent error patterns

---

## 5. Prioritised Action List

| # | Action | Severity | Effort |
|---|--------|----------|--------|
| — | No actions required | — | — |

**Effect strategy is sound. No changes needed.**

---

**Cross-references**:
- [.github/copilot-instructions.md](.github/copilot-instructions.md) (Rules 2, 5)
