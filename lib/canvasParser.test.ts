import { describe, it, expect } from "vitest";
import { parseCanvasState } from "./canvasParser";
import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

describe("parseCanvasState", () => {
  it("returns empty message when no nodes or edges", () => {
    expect(parseCanvasState([], [])).toBe("The diagram is empty.");
  });

  it("serializes nodes with id, type, label, position", () => {
    const nodes: ReactFlowNode[] = [
      {
        id: "n1",
        type: "s3",
        position: { x: 100, y: 200 },
        data: { label: "My Bucket" },
      },
    ];
    const result = parseCanvasState(nodes, []);
    expect(result).toContain("Nodes:");
    expect(result).toContain("n1");
    expect(result).toContain("My Bucket");
    expect(result).toContain("s3");
    expect(result).toContain("100");
    expect(result).toContain("200");
  });

  it("serializes edges with source and target", () => {
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "n1", target: "n2" },
    ];
    const result = parseCanvasState([], edges);
    expect(result).toContain("Edges:");
    expect(result).toContain("n1");
    expect(result).toContain("n2");
    expect(result).toContain("e1");
  });

  it("includes both nodes and edges when present", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = parseCanvasState(nodes, edges);
    expect(result).toContain("Nodes:");
    expect(result).toContain("Edges:");
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  it("includes edge label when present", () => {
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "n1", target: "n2", data: { label: "requests" } },
    ];
    const result = parseCanvasState([], edges);
    expect(result).toContain('relationship: "requests"');
  });
});
