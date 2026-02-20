import { describe, it, expect } from "vitest";
import { addEdge } from "reactflow";
import { getSampleCanvasState } from "./canvas";
import type { ReactFlowEdge } from "@/lib/types";

describe("addEdge (connection flow)", () => {
  it("adds a new edge when connecting two node ids", () => {
    const state = getSampleCanvasState();
    const edges = state.edges as ReactFlowEdge[];
    const connection = {
      source: "sample-s3",
      target: "sample-db",
      sourceHandle: null,
      targetHandle: null,
    };
    const nextEdges = addEdge(connection, edges);
    expect(nextEdges).toHaveLength(edges.length + 1);
    const added = nextEdges.find(
      (e) => e.source === "sample-s3" && e.target === "sample-db"
    );
    expect(added).toBeDefined();
    expect(added!.id).toBeDefined();
  });

  it("does not mutate the original edges array", () => {
    const state = getSampleCanvasState();
    const edges = [...state.edges];
    const connection = { source: "sample-client", target: "sample-s3", sourceHandle: null, targetHandle: null };
    addEdge(connection, edges);
    expect(edges).toHaveLength(state.edges.length);
  });
});
