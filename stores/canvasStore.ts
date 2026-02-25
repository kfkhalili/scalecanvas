import { Option } from "effect";
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

const persistStorage = typeof window !== "undefined"
  ? createJSONStorage(() => localStorage)
  : undefined;

export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      viewport: Option.none(),
      evaluateAction: Option.none(),
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
      setEvaluateAction: (action) => set({ evaluateAction: action }),
      setHasAttemptedEval: (hasAttemptedEval) => set({ hasAttemptedEval }),
      setCanvasState: (state) =>
        set({
          nodes: state.nodes,
          edges: state.edges,
          viewport: Option.fromNullable(state.viewport),
        }),
      getCanvasState: () => {
        const { nodes, edges, viewport } = get();
        const viewportValue = Option.getOrUndefined(viewport);
        return replaceCanvasState(
          { nodes, edges, viewport: viewportValue },
          nodes,
          edges,
          viewportValue
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
