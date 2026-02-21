import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

/**
 * Pure function: serialize canvas into a compact string for LLM context and change detection.
 * Omits node IDs, coordinates, and edge IDs to reduce tokens and avoid triggering on noise.
 */
export function parseCanvasState(
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>
): string {
  if (nodes.length === 0 && edges.length === 0) {
    return "The diagram is empty.";
  }
  const idToLabel = new Map<string, string>();
  for (const n of nodes) {
    const label = n.data?.label ?? n.type ?? n.id;
    idToLabel.set(n.id, label);
  }
  const type = (n: ReactFlowNode) => n.type ?? "default";
  const nodeLines = nodes.map(
    (n) => `- ${idToLabel.get(n.id)!} (${type(n)})`
  );
  const edgeLines = edges.map((e) => {
    const src = idToLabel.get(e.source) ?? e.source;
    const tgt = idToLabel.get(e.target) ?? e.target;
    const rel = e.data?.label ? ` [${e.data.label}]` : "";
    return `- ${src} → ${tgt}${rel}`;
  });
  const parts: string[] = [];
  if (nodeLines.length > 0) {
    parts.push("Nodes:\n" + nodeLines.join("\n"));
  }
  if (edgeLines.length > 0) {
    parts.push("Edges:\n" + edgeLines.join("\n"));
  }
  return parts.join("\n\n");
}
