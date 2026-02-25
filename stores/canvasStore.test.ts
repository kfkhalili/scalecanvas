import { describe, it, expect, beforeEach } from "vitest";
import { Option } from "effect";
import { useCanvasStore } from "./canvasStore";
import { getSampleCanvasState } from "@/lib/canvas";
import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    viewport: Option.none(),
    evaluateAction: Option.none(),
    hasAttemptedEval: false,
  });
});

describe("canvasStore", () => {
  it("initial state has no nodes and no edges", () => {
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });

  it("setCanvasState replaces nodes and edges", () => {
    const newNodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    const newEdges: ReactFlowEdge[] = [
      { id: "e1", source: "a", target: "b" },
    ];
    useCanvasStore.getState().setCanvasState({ nodes: newNodes, edges: newEdges });
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    expect(useCanvasStore.getState().nodes[0].id).toBe("a");
  });

  it("setNodes updates only nodes", () => {
    const initialEdges = useCanvasStore.getState().edges;
    useCanvasStore.getState().setNodes([]);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(useCanvasStore.getState().edges).toBe(initialEdges);
  });

  it("setEdges updates only edges", () => {
    const initialNodes = useCanvasStore.getState().nodes;
    useCanvasStore.getState().setEdges([]);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    expect(useCanvasStore.getState().nodes).toBe(initialNodes);
  });

  it("setViewport updates viewport", () => {
    useCanvasStore.getState().setViewport(Option.some({ x: 10, y: 20, zoom: 1.5 }));
    expect(Option.getOrNull(useCanvasStore.getState().viewport)).toEqual({
      x: 10,
      y: 20,
      zoom: 1.5,
    });
  });

  it("getCanvasState returns current nodes, edges, viewport", () => {
    const sample = getSampleCanvasState();
    useCanvasStore.getState().setCanvasState(sample);
    useCanvasStore.getState().setViewport(Option.some({ x: 1, y: 2, zoom: 1 }));
    const state = useCanvasStore.getState().getCanvasState();
    expect(state.nodes).toEqual(useCanvasStore.getState().nodes);
    expect(state.edges).toEqual(useCanvasStore.getState().edges);
    expect(state.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
  });

  describe("evaluateAction", () => {
    it("initial state has none evaluateAction", () => {
      expect(Option.isNone(useCanvasStore.getState().evaluateAction)).toBe(
        true
      );
    });

    it("setEvaluateAction sets action for FlowCanvas Evaluate button", () => {
      const noop = () => {};
      useCanvasStore.getState().setEvaluateAction(
        Option.some({
          evaluate: noop,
          canEvaluate: true,
          isEvaluating: false,
        })
      );
      const actionOpt = useCanvasStore.getState().evaluateAction;
      expect(Option.isSome(actionOpt)).toBe(true);
      Option.match(actionOpt, {
        onNone: () => {
          throw new Error("expected Some");
        },
        onSome: (action) => {
          expect(action.evaluate).toBe(noop);
          expect(action.canEvaluate).toBe(true);
          expect(action.isEvaluating).toBe(false);
        },
      });
    });

    it("setEvaluateAction(Option.none()) clears action", () => {
      useCanvasStore.getState().setEvaluateAction(
        Option.some({
          evaluate: () => {},
          canEvaluate: false,
          isEvaluating: false,
        })
      );
      useCanvasStore.getState().setEvaluateAction(Option.none());
      expect(Option.isNone(useCanvasStore.getState().evaluateAction)).toBe(
        true
      );
    });
  });

  describe("hasAttemptedEval (PLG)", () => {
    it("initial state has hasAttemptedEval false", () => {
      expect(useCanvasStore.getState().hasAttemptedEval).toBe(false);
    });

    it("setHasAttemptedEval sets flag for anonymous eval handoff", () => {
      useCanvasStore.getState().setHasAttemptedEval(true);
      expect(useCanvasStore.getState().hasAttemptedEval).toBe(true);
      useCanvasStore.getState().setHasAttemptedEval(false);
      expect(useCanvasStore.getState().hasAttemptedEval).toBe(false);
    });
  });
});
