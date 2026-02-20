import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

/**
 * Pure function: serialize canvas nodes and edges into a string for LLM context.
 * No side effects, no I/O.
 */
export function parseCanvasState(
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>
): string {
  if (nodes.length === 0 && edges.length === 0) {
    return "The diagram is empty.";
  }
  const nodeLines = nodes.map((n) => {
    const label = n.data?.label ?? n.type ?? n.id;
    return `- ${n.id}: ${label} (type: ${n.type ?? "default"}) at (${n.position.x}, ${n.position.y})`;
  });
  const edgeLines = edges.map(
    (e) => `- ${e.source} → ${e.target}${e.id ? ` (id: ${e.id})` : ""}`
  );
  const parts: string[] = [];
  if (nodeLines.length > 0) {
    parts.push("Nodes:\n" + nodeLines.join("\n"));
  }
  if (edgeLines.length > 0) {
    parts.push("Edges:\n" + edgeLines.join("\n"));
  }
  return parts.join("\n\n");
}
