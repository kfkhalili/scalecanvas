import { create } from "zustand";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
  CanvasState,
} from "@/lib/types";
import { replaceCanvasState } from "@/lib/canvas";

export type EvaluateAction = {
  evaluate: () => void;
  canEvaluate: boolean;
  isEvaluating: boolean;
};

type CanvasStore = {
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport: Viewport | undefined;
  /** Set by ChatPanel so FlowCanvas can show the Evaluate button. */
  evaluateAction: EvaluateAction | null;
  setNodes: (nodes: ReadonlyArray<ReactFlowNode>) => void;
  setEdges: (edges: ReadonlyArray<ReactFlowEdge>) => void;
  setViewport: (viewport: Viewport | undefined) => void;
  setCanvasState: (state: CanvasState) => void;
  setEvaluateAction: (action: EvaluateAction | null) => void;
  getCanvasState: () => CanvasState;
};

const initial: CanvasState = { nodes: [], edges: [], viewport: undefined };

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  viewport: initial.viewport,
  evaluateAction: null,
  setNodes: (nodes) =>
    set((state) => ({
      nodes,
      edges: state.edges,
      viewport: state.viewport,
    })),
  setEdges: (edges) =>
    set((state) => ({
      nodes: state.nodes,
      edges,
      viewport: state.viewport,
    })),
  setViewport: (viewport) =>
    set((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      viewport,
    })),
  setEvaluateAction: (evaluateAction) => set({ evaluateAction }),
  setCanvasState: (state) =>
    set({
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
    }),
  getCanvasState: () => {
    const { nodes, edges, viewport } = get();
    return replaceCanvasState(
      { nodes, edges, viewport },
      nodes,
      edges,
      viewport
    );
  },
}));
