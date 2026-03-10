import { Option } from "effect";
import { create } from "zustand";
import {
  applyNodeChanges as rfApplyNodeChanges,
  applyEdgeChanges as rfApplyEdgeChanges,
  addEdge,
  reconnectEdge as rfReconnectEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
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

  // Domain actions for controlled ReactFlow mode
  onNodesChange: (changes: NodeChange<ReactFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ReactFlowEdge>[]) => void;
  connectNodes: (connection: Connection) => void;
  doReconnectEdge: (oldEdge: ReactFlowEdge, connection: Connection) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  updateEdgeLabelPosition: (edgeId: string, offsetX: number, offsetY: number) => void;
  addNode: (node: ReactFlowNode) => void;
  deselectAll: () => void;
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

  // Domain actions for controlled ReactFlow mode
  onNodesChange: (changes) =>
    set({ nodes: rfApplyNodeChanges(changes, [...get().nodes]) }),
  onEdgesChange: (changes) =>
    set({ edges: rfApplyEdgeChanges(changes, [...get().edges]) }),
  connectNodes: (connection) => {
    const prev = [...get().edges];
    const next = addEdge(connection, prev);
    const prevIds = new Set(prev.map((e) => e.id));
    set({
      edges: next.map((e) =>
        prevIds.has(e.id) ? e : { ...e, data: { ...e.data, label: "" } }
      ),
    });
  },
  doReconnectEdge: (oldEdge, connection) => {
    const next = rfReconnectEdge(oldEdge, connection, [...get().edges]);
    set({
      edges: next.map((e) =>
        e.id === oldEdge.id
          ? { ...e, data: { ...e.data, ...oldEdge.data } }
          : e
      ),
    });
  },
  updateEdgeLabel: (edgeId, label) =>
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, label } } : e
      ),
    }),
  updateEdgeLabelPosition: (edgeId, offsetX, offsetY) =>
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              data: {
                ...e.data,
                labelOffsetX: offsetX,
                labelOffsetY: offsetY,
              },
            }
          : e
      ),
    }),
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  deselectAll: () =>
    set({
      nodes: get().nodes.map((n) => ({ ...n, selected: false })),
      edges: get().edges.map((e) => ({ ...e, selected: false })),
    }),
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
