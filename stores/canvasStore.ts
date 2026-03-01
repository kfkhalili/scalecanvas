import { Option } from "effect";
import { create } from "zustand";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
  CanvasState,
} from "@/lib/types";
import { makeCanvasState, resolveEdgeHandles } from "@/lib/canvas";
import { readFromStorage, isViewport } from "@/stores/anonymousWorkspaceStorage";

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

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
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
}));

/**
 * Synchronously read canvas state from the single anonymous-workspace key and apply.
 * Returns true if state was applied.
 */
export function applyPersistedCanvasStateSync(): boolean {
  const state = readFromStorage();
  if (!state || !Array.isArray(state.nodes)) return false;
  const viewport =
    state.viewport != null && isViewport(state.viewport)
      ? state.viewport
      : undefined;
  const nodes = state.nodes as ReadonlyArray<ReactFlowNode>;
  const edges = (Array.isArray(state.edges) ? state.edges : []) as ReadonlyArray<ReactFlowEdge>;
  useCanvasStore.getState().setCanvasState({
    nodes,
    edges: resolveEdgeHandles(nodes, edges),
    viewport,
  });
  if (typeof state.hasAttemptedEval === "boolean") {
    useCanvasStore.getState().setHasAttemptedEval(state.hasAttemptedEval);
  }
  return true;
}

/** No-op: rehydration is sync via applyPersistedCanvasStateSync / loadAnonymousWorkspace. */
export function onCanvasRehydrationFinished(
  _callback: () => void
): (() => void) | undefined {
  return () => {};
}

if (typeof window !== "undefined") {
  applyPersistedCanvasStateSync();
}
