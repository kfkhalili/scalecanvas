import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Pure function: serialize canvas into XML for LLM context and change detection.
 * Omits node IDs, coordinates, and edge IDs to reduce tokens and avoid triggering on noise.
 */
export function parseCanvasState(
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>
): string {
  const idToLabel = new Map<string, string>();
  for (const n of nodes) {
    const label = n.data?.label ?? n.type ?? n.id;
    idToLabel.set(n.id, label);
  }
  const type = (n: ReactFlowNode) => n.type ?? "default";
  const nodeLines = nodes.map(
    (n) => `- ${escapeXml(idToLabel.get(n.id)!)} (${escapeXml(type(n))})`
  );
  const edgeLines = edges.map((e) => {
    const src = escapeXml(idToLabel.get(e.source) ?? e.source);
    const tgt = escapeXml(idToLabel.get(e.target) ?? e.target);
    const rel = e.data?.label ? ` [${escapeXml(e.data.label)}]` : "";
    return `- ${src} → ${tgt}${rel}`;
  });
  const nodesContent =
    nodes.length === 0 ? "" : "\n" + nodeLines.join("\n") + "\n  ";
  const edgesContent =
    edges.length === 0 ? "" : "\n" + edgeLines.join("\n") + "\n  ";
  return `<canvas_state>
  <nodes>${nodesContent}</nodes>
  <edges>${edgesContent}</edges>
</canvas_state>`;
}
