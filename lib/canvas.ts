import type {
  CanvasState,
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
} from "@/lib/types";
import type { DbCanvasState } from "@/lib/database.types";

function parseViewport(value: DbCanvasState["viewport"]): Viewport | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && "x" in value && "y" in value && "zoom" in value) {
    const o = value as Viewport;
    return { x: o.x, y: o.y, zoom: o.zoom };
  }
  return undefined;
}

export function canvasFromDb(db: DbCanvasState): CanvasState {
  return {
    nodes: db.nodes ?? [],
    edges: db.edges ?? [],
    viewport: parseViewport(db.viewport),
  };
}

export function replaceCanvasState(
  _current: CanvasState,
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>,
  viewport?: Viewport
): CanvasState {
  return { nodes, edges, viewport };
}
