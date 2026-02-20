import { create } from "zustand";
import type {
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
  CanvasState,
} from "@/lib/types";
import { replaceCanvasState, getSampleCanvasState } from "@/lib/canvas";

type CanvasStore = {
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport: Viewport | undefined;
  setNodes: (nodes: ReadonlyArray<ReactFlowNode>) => void;
  setEdges: (edges: ReadonlyArray<ReactFlowEdge>) => void;
  setViewport: (viewport: Viewport | undefined) => void;
  setCanvasState: (state: CanvasState) => void;
  getCanvasState: () => CanvasState;
};

const initial = getSampleCanvasState();

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  viewport: initial.viewport,
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
