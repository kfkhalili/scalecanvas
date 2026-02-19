import { describe, it, expect } from "vitest";
import { canvasFromDb, replaceCanvasState } from "./canvas";
import type { DbCanvasState } from "@/lib/database.types";
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
