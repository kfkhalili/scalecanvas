import { Option } from "effect";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
  CanvasState,
} from "@/lib/types";
import { makeCanvasState, resolveEdgeHandles } from "@/lib/canvas";

export type EvaluateAction = {
  evaluate: () => void;
  canEvaluate: boolean;
  isEvaluating: boolean;
};

type CanvasStore = {
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport: Option.Option<Viewport>;
  /** Set by ChatPanel so FlowCanvas can show the Evaluate button. */
  evaluateAction: Option.Option<EvaluateAction>;
  /** PLG: true after anonymous user clicks Evaluate or sends chat; survives OAuth redirect. */
  hasAttemptedEval: boolean;
  setNodes: (nodes: ReadonlyArray<ReactFlowNode>) => void;
  setEdges: (edges: ReadonlyArray<ReactFlowEdge>) => void;
  setViewport: (viewport: Option.Option<Viewport>) => void;
  setCanvasState: (state: CanvasState) => void;
  setEvaluateAction: (action: Option.Option<EvaluateAction>) => void;
  setHasAttemptedEval: (value: boolean) => void;
  getCanvasState: () => CanvasState;
};

const initialNodes: ReadonlyArray<ReactFlowNode> = [];
const initialEdges: ReadonlyArray<ReactFlowEdge> = [];

const PERSIST_KEY = "scalecanvas-canvas";

const persistStorage = typeof window !== "undefined"
  ? createJSONStorage(() => localStorage)
  : undefined;

type PersistedState = {
  nodes?: unknown[];
  edges?: unknown[];
  hasAttemptedEval?: boolean;
  viewport?: { _tag?: string; value?: Viewport };
};

export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      viewport: Option.none(),
      evaluateAction: Option.none(),
      hasAttemptedEval: false,
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      setViewport: (viewport) => set({ viewport }),
      setEvaluateAction: (action) => set({ evaluateAction: action }),
      setHasAttemptedEval: (hasAttemptedEval) => set({ hasAttemptedEval }),
      setCanvasState: (state) =>
        set({
          nodes: state.nodes,
          edges: resolveEdgeHandles(state.nodes, state.edges),
          viewport: Option.fromNullable(state.viewport),
        }),
      getCanvasState: () => {
        const { nodes, edges, viewport } = get();
        const viewportValue = Option.getOrUndefined(viewport);
        return makeCanvasState(
          nodes,
          edges,
          viewportValue
        );
      },
    }),
    {
      name: PERSIST_KEY,
      storage: persistStorage,
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        hasAttemptedEval: state.hasAttemptedEval,
      }),
      merge: (persisted, current) => {
        const p = persisted as { nodes?: unknown[]; edges?: unknown[]; hasAttemptedEval?: boolean } | undefined;
        return {
          ...current,
          nodes: Array.isArray(p?.nodes) ? p.nodes as ReadonlyArray<ReactFlowNode> : current.nodes,
          edges: Array.isArray(p?.edges) ? p.edges as ReadonlyArray<ReactFlowEdge> : current.edges,
          hasAttemptedEval: typeof p?.hasAttemptedEval === "boolean" ? p.hasAttemptedEval : current.hasAttemptedEval,
        };
      },
      skipHydration: true,
    }
  )
);

type CanvasPersistApi = {
  rehydrate: () => Promise<void>;
  onFinishHydration: (cb: () => void) => () => void;
};

/** Call once on client mount to rehydrate from localStorage (avoids SSR mismatch). */
export function rehydrateCanvasStore(): Promise<void> | undefined {
  const store = useCanvasStore as unknown as { persist?: CanvasPersistApi };
  return store.persist?.rehydrate();
}

/**
 * Synchronously read canvas state from localStorage and apply to the store.
 * Use for anonymous users so FlowCanvas never mounts with empty state before
 * async rehydration completes. Returns true if state was applied.
 */
export function applyPersistedCanvasStateSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: PersistedState; version?: number };
    const state = parsed?.state;
    if (!state || !Array.isArray(state.nodes)) return false;
    const viewport =
      state.viewport?.value ?? (state.viewport as PersistedState["viewport"])?.value;
    useCanvasStore.getState().setCanvasState({
      nodes: state.nodes as ReadonlyArray<ReactFlowNode>,
      edges: (Array.isArray(state.edges) ? state.edges : []) as ReadonlyArray<ReactFlowEdge>,
      viewport:
        viewport && typeof viewport === "object" && "x" in viewport && "y" in viewport && "zoom" in viewport
          ? viewport
          : undefined,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to canvas store rehydration completion. Call before rehydrate() so
 * the callback runs when persistence has finished loading (avoids showing
 * canvas with empty state before localStorage is merged).
 */
export function onCanvasRehydrationFinished(
  callback: () => void
): (() => void) | undefined {
  const store = useCanvasStore as unknown as { persist?: CanvasPersistApi };
  return store.persist?.onFinishHydration(callback);
}

// Apply persisted state as soon as the store module loads on the client, so
// the store is populated before any component (e.g. FlowCanvas) runs and writes.
if (typeof window !== "undefined") {
  applyPersistedCanvasStateSync();
}
