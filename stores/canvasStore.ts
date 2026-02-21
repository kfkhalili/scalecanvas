import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
  /** PLG: true after anonymous user clicks Evaluate or sends chat; survives OAuth redirect. */
  hasAttemptedEval: boolean;
  setNodes: (nodes: ReadonlyArray<ReactFlowNode>) => void;
  setEdges: (edges: ReadonlyArray<ReactFlowEdge>) => void;
  setViewport: (viewport: Viewport | undefined) => void;
  setCanvasState: (state: CanvasState) => void;
  setEvaluateAction: (action: EvaluateAction | null) => void;
  setHasAttemptedEval: (value: boolean) => void;
  getCanvasState: () => CanvasState;
};

const initial: CanvasState = { nodes: [], edges: [], viewport: undefined };

const persistStorage = typeof window !== "undefined"
  ? createJSONStorage(() => localStorage)
  : undefined;

export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      nodes: initial.nodes,
      edges: initial.edges,
      viewport: initial.viewport,
      evaluateAction: null,
      hasAttemptedEval: false,
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
      setHasAttemptedEval: (hasAttemptedEval) => set({ hasAttemptedEval }),
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
    }),
    {
      name: "scalecanvas-canvas",
      storage: persistStorage,
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        hasAttemptedEval: state.hasAttemptedEval,
      }),
      skipHydration: true,
    }
  )
);

/** Call once on client mount to rehydrate from localStorage (avoids SSR mismatch). */
export function rehydrateCanvasStore(): Promise<void> | undefined {
  const store = useCanvasStore as unknown as { persist?: { rehydrate: () => Promise<void> } };
  return store.persist?.rehydrate();
}
