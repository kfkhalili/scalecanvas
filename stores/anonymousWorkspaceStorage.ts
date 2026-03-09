/**
 * Single localStorage key for anonymous workspace: chat (topic + messages) and
 * canvas (nodes, edges, viewport) as one unit. Replaces separate
 * scalecanvas-auth-handoff and scalecanvas-canvas keys when anonymous.
 */

import { Option } from "effect";
import { toast } from "sonner";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
} from "@/lib/types";
import type { AnonymousMessage } from "@/stores/authHandoffStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";

export const ANONYMOUS_WORKSPACE_KEY = "scalecanvas-anonymous-workspace";

export type PersistedAnonymousWorkspace = {
  anonymousMessages: AnonymousMessage[];
  questionTitle: string | null;
  questionTopicId: string | null;
  nodes: unknown[];
  edges: unknown[];
  hasAttemptedEval: boolean;
  /** Plain nullable viewport — no Effect internals in storage. */
  viewport?: Viewport | null;
};

const LEGACY_HANDOFF_KEY = "scalecanvas-auth-handoff";
const LEGACY_CANVAS_KEY = "scalecanvas-canvas";

/** Merge legacy keys into one and write to ANONYMOUS_WORKSPACE_KEY. Returns merged state or null. */
function migrateFromLegacyKeys(): PersistedAnonymousWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const handoffRaw = localStorage.getItem(LEGACY_HANDOFF_KEY);
    const canvasRaw = localStorage.getItem(LEGACY_CANVAS_KEY);
    if (!handoffRaw && !canvasRaw) return null;
    const handoff = handoffRaw
      ? (JSON.parse(handoffRaw) as { state?: { anonymousMessages?: AnonymousMessage[]; questionTitle?: string | null; questionTopicId?: string | null } })
      : null;
    const canvas = canvasRaw
      ? (JSON.parse(canvasRaw) as { state?: { nodes?: unknown[]; edges?: unknown[]; hasAttemptedEval?: boolean; viewport?: unknown } })
      : null;
    // Legacy canvas store serialized viewport as Effect Option: {_tag:"Some",value:{...}}.
    // Normalize to plain Viewport | null at migration time.
    const legacyViewport = canvas?.state?.viewport as { _tag?: string; value?: unknown } | null | undefined;
    const migratedViewport: Viewport | null =
      legacyViewport != null && legacyViewport._tag === "Some" && isViewport(legacyViewport.value)
        ? legacyViewport.value
        : null;
    const state: PersistedAnonymousWorkspace = {
      anonymousMessages: handoff?.state?.anonymousMessages ?? [],
      questionTitle: handoff?.state?.questionTitle ?? null,
      questionTopicId: handoff?.state?.questionTopicId ?? null,
      nodes: canvas?.state?.nodes ?? [],
      edges: canvas?.state?.edges ?? [],
      hasAttemptedEval: canvas?.state?.hasAttemptedEval ?? false,
      viewport: migratedViewport,
    };
    localStorage.setItem(ANONYMOUS_WORKSPACE_KEY, JSON.stringify({ state, version: 0 }));
    localStorage.removeItem(LEGACY_HANDOFF_KEY);
    localStorage.removeItem(LEGACY_CANVAS_KEY);
    return state;
  } catch {
    return null;
  }
}

/** Read-only; does not import stores. Used by canvasStore on init to avoid cycles. */
export function readFromStorage(): PersistedAnonymousWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ANONYMOUS_WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: PersistedAnonymousWorkspace; version?: number };
      return parsed?.state ?? null;
    }
    return migrateFromLegacyKeys();
  } catch {
    return null;
  }
}

export function isViewport(v: unknown): v is Viewport {
  return (
    typeof v === "object" &&
    v !== null &&
    "x" in v &&
    "y" in v &&
    "zoom" in v
  );
}

/**
 * Load the single anonymous-workspace key and apply to canvas and auth handoff stores.
 * Call when the anonymous view mounts so chat and canvas are one unit.
 */
export function loadAnonymousWorkspace(): boolean {
  const state = readFromStorage();
  if (!state) return false;

  const canvas = useCanvasStore.getState();
  const handoff = useAuthHandoffStore.getState();

  if (Array.isArray(state.nodes) && Array.isArray(state.edges)) {
    const viewport =
      state.viewport != null && isViewport(state.viewport)
        ? state.viewport
        : undefined;
    canvas.setCanvasState({
      nodes: state.nodes as ReactFlowNode[],
      edges: state.edges as ReactFlowEdge[],
      viewport,
    });
  }
  if (typeof state.hasAttemptedEval === "boolean") {
    canvas.setHasAttemptedEval(state.hasAttemptedEval);
  }

  if (Array.isArray(state.anonymousMessages)) {
    handoff.setAnonymousMessages(state.anonymousMessages);
  }
  handoff.setQuestionTitle(Option.fromNullable(state.questionTitle));
  handoff.setQuestionTopicId(Option.fromNullable(state.questionTopicId));

  return true;
}

/** Shown at most once per page load so we don't spam on every node drag. */
let storageWarningShown = false;

/**
 * Persist current canvas and handoff state to the single key.
 * Call when the anonymous view is active and either store changes.
 */
export function persistAnonymousWorkspace(): void {
  if (typeof window === "undefined") return;
  const canvas = useCanvasStore.getState();
  const handoff = useAuthHandoffStore.getState();

  const viewport = canvas.viewport;
  const viewportPayload: Viewport | null = Option.getOrNull(viewport);

  const state: PersistedAnonymousWorkspace = {
    anonymousMessages: handoff.anonymousMessages,
    questionTitle: Option.getOrNull(handoff.questionTitle),
    questionTopicId: Option.getOrNull(handoff.questionTopicId),
    nodes: [...canvas.nodes],
    edges: [...canvas.edges],
    hasAttemptedEval: canvas.hasAttemptedEval,
    viewport: viewportPayload,
  };

  try {
    localStorage.setItem(
      ANONYMOUS_WORKSPACE_KEY,
      JSON.stringify({ state, version: 0 })
    );
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      toast.warning(
        "Your progress may not be saved. Storage is full or unavailable \u2014 sign in to keep your work."
      );
    }
  }
}

/**
 * Clear anonymous workspace (and legacy keys) from localStorage.
 * Call on sign-out so the next load gets a clean canvas and a fresh question.
 */
export function clearAnonymousWorkspaceStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ANONYMOUS_WORKSPACE_KEY);
    localStorage.removeItem(LEGACY_HANDOFF_KEY);
    localStorage.removeItem(LEGACY_CANVAS_KEY);
  } catch {
    // ignore
  }
}

