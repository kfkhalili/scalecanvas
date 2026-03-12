/**
 * Explicit workspace lifecycle state machine.
 *
 * Replaces distributed state variables across InterviewSplitView, PostAuthRoot,
 * FlowCanvas, sessionStore, and authHandoffStore with a single discriminated
 * union. Components read the phase to decide what to render; the persistence
 * layer reads it to decide how (and whether) to save.
 *
 * Transition diagram:
 *
 *   boot ─────┬──→ anonymous
 *             ├──→ bootstrapping ──→ loading-session
 *             └──→ loading-session  (direct page load of /[sessionId])
 *
 *   loading-session ──→ active     (session is currently running)
 *   loading-session ──→ inactive   (session is not currently active)
 *
 *   inactive ──→ active            (user spends a token)
 *   inactive ──→ loading-session   (switch to another session)
 *
 *   active ──→ inactive            (time expired, or interview ended)
 *   active ──→ loading-session     (switch to another session)
 *
 * `anonymous` has no outgoing client transitions — leaving anonymous mode is
 * an OAuth redirect (page reload). A new state machine starts at `boot`.
 *
 * `inactive` means "session exists but is not currently active." The user can
 * reactivate by spending a token. Canvas and chat are view-only; an "Activate"
 * CTA is shown.
 */

import { match, P } from "ts-pattern";

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

export type WorkspacePhase =
  | { readonly phase: "boot" }
  | { readonly phase: "anonymous" }
  | { readonly phase: "bootstrapping" }
  | { readonly phase: "loading-session"; readonly sessionId: string }
  | { readonly phase: "active"; readonly sessionId: string }
  | { readonly phase: "inactive"; readonly sessionId: string };

/** Discriminant values — useful for transition table keys and exhaustive tests. */
export type PhaseName = WorkspacePhase["phase"];

export const ALL_PHASES: readonly PhaseName[] = [
  "boot",
  "anonymous",
  "bootstrapping",
  "loading-session",
  "active",
  "inactive",
] as const;

// ---------------------------------------------------------------------------
// Derived queries
// ---------------------------------------------------------------------------

/** Extract the sessionId from phases that carry one, or undefined. */
export function sessionIdOf(wp: WorkspacePhase): string | undefined {
  return match(wp)
    .with({ phase: "loading-session" }, (p) => p.sessionId)
    .with({ phase: "active" }, (p) => p.sessionId)
    .with({ phase: "inactive" }, (p) => p.sessionId)
    .otherwise(() => undefined);
}

/** Whether the UI is interactive (canvas editable + chat input enabled). */
export function canInteract(wp: WorkspacePhase): boolean {
  return wp.phase === "anonymous" || wp.phase === "active";
}

/** Whether chat messages are sent to the AI backend. */
export function canChat(wp: WorkspacePhase): boolean {
  return wp.phase === "active";
}

/** Whether the "Activate session" CTA should be shown. */
export function showActivationCta(wp: WorkspacePhase): boolean {
  return wp.phase === "inactive";
}

/** Whether the persistence layer should run (debounce + save) in this phase. */
export function shouldPersist(wp: WorkspacePhase): boolean {
  return wp.phase === "anonymous" || wp.phase === "active";
}

/**
 * Which persistence implementation to use.
 *
 * - `local`  — localStorage (anonymous users)
 * - `api`    — PUT /api/sessions/:id/canvas (authenticated sessions)
 * - `none`   — no persistence (boot, bootstrapping, loading, inactive)
 */
export type PersistenceMode = "local" | "api" | "none";

export function persistenceMode(wp: WorkspacePhase): PersistenceMode {
  return match(wp)
    .with({ phase: "anonymous" }, (): PersistenceMode => "local")
    .with({ phase: "active" }, (): PersistenceMode => "api")
    .with(
      { phase: P.union("boot", "bootstrapping", "loading-session", "inactive") },
      (): PersistenceMode => "none",
    )
    .exhaustive();
}

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

/** Allowed transitions. Any transition not listed here is a programming error. */
const VALID_TRANSITIONS: Readonly<Record<PhaseName, ReadonlySet<PhaseName>>> = {
  boot: new Set<PhaseName>(["anonymous", "bootstrapping", "loading-session"]),
  anonymous: new Set<PhaseName>([]),
  bootstrapping: new Set<PhaseName>(["loading-session"]),
  "loading-session": new Set<PhaseName>(["active", "inactive"]),
  active: new Set<PhaseName>(["loading-session", "inactive"]),
  inactive: new Set<PhaseName>(["active", "loading-session"]),
};

/** Check whether a given phase transition is allowed by the state machine. */
export function isValidTransition(from: PhaseName, to: PhaseName): boolean {
  return VALID_TRANSITIONS[from].has(to);
}

/** Return the set of phases reachable from a given phase. */
export function validTargets(from: PhaseName): ReadonlySet<PhaseName> {
  return VALID_TRANSITIONS[from];
}
