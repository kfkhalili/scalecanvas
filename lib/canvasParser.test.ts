import { describe, it, expect } from "vitest";
import { parseCanvasState } from "./canvasParser";
import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

describe("parseCanvasState", () => {
  it("returns empty message when no nodes or edges", () => {
    expect(parseCanvasState([], [])).toBe("The diagram is empty.");
  });

  it("serializes nodes as label and type only (no id or position)", () => {
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
    expect(result).toContain("My Bucket");
    expect(result).toContain("s3");
    expect(result).not.toContain("n1");
    expect(result).not.toContain("100");
    expect(result).not.toContain("200");
  });

  it("serializes edges by label when nodes present (no edge id)", () => {
    const nodes: ReactFlowNode[] = [
      { id: "n1", type: "lambda", position: { x: 0, y: 0 }, data: { label: "API" } },
      { id: "n2", type: "s3", position: { x: 0, y: 0 }, data: { label: "Bucket" } },
    ];
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "n1", target: "n2" },
    ];
    const result = parseCanvasState(nodes, edges);
    expect(result).toContain("Edges:");
    expect(result).toContain("API");
    expect(result).toContain("Bucket");
    expect(result).toContain("API → Bucket");
    expect(result).not.toContain("e1");
    expect(result).not.toContain("n1");
  });

  it("includes both nodes and edges when present", () => {
    const nodes: ReactFlowNode[] = [
      { id: "a", type: "default", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = parseCanvasState(nodes, edges);
    expect(result).toContain("Nodes:");
    expect(result).toContain("Edges:");
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).not.toContain("e1");
  });

  it("includes edge relationship when present", () => {
    const nodes: ReactFlowNode[] = [
      { id: "n1", type: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "n2", type: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: ReactFlowEdge[] = [
      { id: "e1", source: "n1", target: "n2", data: { label: "requests" } },
    ];
    const result = parseCanvasState(nodes, edges);
    expect(result).toContain("[requests]");
  });
});
