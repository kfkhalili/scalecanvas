import { create } from "zustand";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
  CanvasState,
} from "@/lib/types";
import { replaceCanvasState } from "@/lib/canvas";

type CanvasStore = {
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport: Viewport | undefined;
  /** When true, canvas changes trigger a debounced Bedrock review. */
  canvasReviewScheduledEnabled: boolean;
  setNodes: (nodes: ReadonlyArray<ReactFlowNode>) => void;
  setEdges: (edges: ReadonlyArray<ReactFlowEdge>) => void;
  setViewport: (viewport: Viewport | undefined) => void;
  setCanvasState: (state: CanvasState) => void;
  setCanvasReviewScheduledEnabled: (enabled: boolean) => void;
  getCanvasState: () => CanvasState;
};

const initial: CanvasState = { nodes: [], edges: [], viewport: undefined };

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  viewport: initial.viewport,
  canvasReviewScheduledEnabled: false,
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
  setCanvasReviewScheduledEnabled: (enabled) =>
    set((state) => ({
      ...state,
      canvasReviewScheduledEnabled: enabled,
    })),
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
