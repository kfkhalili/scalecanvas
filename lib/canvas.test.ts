import { describe, it, expect } from "vitest";
import { canvasFromDb, replaceCanvasState, getSampleCanvasState, resolveEdgeHandles } from "./canvas";
import type { DbCanvasState } from "@/lib/database.aliases";
import type { CanvasState, ReactFlowNode, ReactFlowEdge, Viewport } from "@/lib/types";

describe("canvasFromDb", () => {
  it("parses DbCanvasState into CanvasState (nodes, edges, viewport)", () => {
    const db: DbCanvasState = {
      id: "c-1",
      session_id: "sess-1",
      nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const result = canvasFromDb(db);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("n1");
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe("n1");
    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("handles null viewport", () => {
    const db: DbCanvasState = {
      id: "c-2",
      session_id: "sess-1",
      nodes: [],
      edges: [],
      viewport: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const result = canvasFromDb(db);
    expect(result.viewport).toBeUndefined();
  });
});

describe("replaceCanvasState", () => {
  it("returns new CanvasState with replaced nodes/edges/viewport (immutable)", () => {
    const current: CanvasState = {
      nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: {} }] as ReactFlowNode[],
      edges: [] as ReactFlowEdge[],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const newNodes: ReadonlyArray<ReactFlowNode> = [
      { id: "n2", position: { x: 10, y: 10 }, data: {} },
    ];
    const newEdges: ReadonlyArray<ReactFlowEdge> = [
      { id: "e1", source: "n2", target: "n3" },
    ];
    const newViewport: Viewport = { x: 1, y: 1, zoom: 1.5 };
    const result = replaceCanvasState(current, newNodes, newEdges, newViewport);
    expect(result.nodes).toBe(newNodes);
    expect(result.edges).toBe(newEdges);
    expect(result.viewport).toEqual(newViewport);
    expect(current.nodes).toHaveLength(1);
  });

  it("allows optional viewport (undefined)", () => {
    const current: CanvasState = { nodes: [], edges: [] };
    const result = replaceCanvasState(current, [], []);
    expect(result.viewport).toBeUndefined();
  });
});

describe("getSampleCanvasState", () => {
  it("returns 5 nodes with expected ids and types", () => {
    const state = getSampleCanvasState();
    expect(state.nodes).toHaveLength(5);
    const ids = state.nodes.map((n) => n.id);
    expect(ids).toContain("sample-client");
    expect(ids).toContain("sample-api");
    expect(ids).toContain("sample-lambda");
    expect(ids).toContain("sample-db");
    expect(ids).toContain("sample-s3");
    expect(state.nodes.find((n) => n.id === "sample-client")?.type).toBe("awsVpc");
    expect(state.nodes.find((n) => n.id === "sample-api")?.type).toBe("awsApiGateway");
  });

  it("returns 4 edges connecting the sample nodes", () => {
    const state = getSampleCanvasState();
    expect(state.edges).toHaveLength(4);
    const sources = state.edges.map((e) => e.source);
    const targets = state.edges.map((e) => e.target);
    expect(sources).toContain("sample-client");
    expect(targets).toContain("sample-api");
    expect(targets).toContain("sample-db");
    expect(targets).toContain("sample-s3");
  });

  it("returns no viewport (undefined)", () => {
    const state = getSampleCanvasState();
    expect(state.viewport).toBeUndefined();
  });

  it("each node has position and data", () => {
    const state = getSampleCanvasState();
    for (const n of state.nodes) {
      expect(n.position).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
      expect(n.data).toBeDefined();
    }
  });
});

describe("resolveEdgeHandles", () => {
  it("sets bottom-out / top when target is below source", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 100, y: 0 }, data: {} },
      { id: "b", position: { x: 100, y: 200 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("bottom-out");
    expect(result[0].targetHandle).toBe("top");
  });

  it("sets top-out / bottom when target is above source", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 100, y: 200 }, data: {} },
      { id: "b", position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("top-out");
    expect(result[0].targetHandle).toBe("bottom");
  });

  it("sets right-out / left when target is to the right", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 100 }, data: {} },
      { id: "b", position: { x: 300, y: 100 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("right-out");
    expect(result[0].targetHandle).toBe("left");
  });

  it("sets left-out / right when target is to the left", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 300, y: 100 }, data: {} },
      { id: "b", position: { x: 0, y: 100 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("left-out");
    expect(result[0].targetHandle).toBe("right");
  });

  it("prefers vertical handles when displacement is equal (45°)", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 100, y: 100 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("bottom-out");
    expect(result[0].targetHandle).toBe("top");
  });

  it("leaves edge unchanged when source node is missing", () => {
    const nodes: ReactFlowNode[] = [
      { id: "b", position: { x: 0, y: 100 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "missing", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0]).toEqual(edges[0]);
  });

  it("leaves edge unchanged when target node is missing", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "missing" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0]).toEqual(edges[0]);
  });

  it("handles co-located nodes (dx=0, dy=0) with bottom-out / top", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 50, y: 50 }, data: {} },
      { id: "b", position: { x: 50, y: 50 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].sourceHandle).toBe("bottom-out");
    expect(result[0].targetHandle).toBe("top");
  });

  it("preserves other edge properties (id, data, etc.)", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 200 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "a", target: "b", data: { label: "hello" } },
    ];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result[0].id).toBe("e1");
    expect(result[0].source).toBe("a");
    expect(result[0].target).toBe("b");
    expect(result[0].data?.label).toBe("hello");
  });

  it("resolves multiple edges independently", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 100, y: 0 }, data: {} },
      { id: "b", position: { x: 100, y: 200 }, data: {} },
      { id: "c", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "c" },
    ];
    const result = resolveEdgeHandles(nodes, edges);
    // a → b is vertical (below)
    expect(result[0].sourceHandle).toBe("bottom-out");
    expect(result[0].targetHandle).toBe("top");
    // a → c is horizontal (right)
    expect(result[1].sourceHandle).toBe("right-out");
    expect(result[1].targetHandle).toBe("left");
  });

  it("returns the same array reference when all handles already match", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 200 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: "bottom-out", targetHandle: "top" },
    ];
    const result = resolveEdgeHandles(nodes, edges);
    expect(result).toBe(edges); // same reference — no unnecessary re-render
  });

  it("returns the same edge object reference when its handles already match", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 200 }, data: {} },
      { id: "c", position: { x: 300, y: 0 }, data: {} },
    ];
    const edgeOk: ReactFlowEdge = { id: "e1", source: "a", target: "b", sourceHandle: "bottom-out", targetHandle: "top" };
    const edgeNeedsUpdate: ReactFlowEdge = { id: "e2", source: "a", target: "c" };
    const edges = [edgeOk, edgeNeedsUpdate];
    const result = resolveEdgeHandles(nodes, edges);
    // Array is new (because one edge changed), but the unchanged edge keeps its reference
    expect(result).not.toBe(edges);
    expect(result[0]).toBe(edgeOk);
    expect(result[1]).not.toBe(edgeNeedsUpdate);
    expect(result[1].sourceHandle).toBe("right-out");
  });

  it("returns the same array reference when calling twice with already-resolved edges", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 200 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const first = resolveEdgeHandles(nodes, edges);
    const second = resolveEdgeHandles(nodes, first);
    expect(second).toBe(first); // idempotent — no infinite loop
  });
});
