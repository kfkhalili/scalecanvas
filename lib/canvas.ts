import { Option } from "effect";
import type {
  CanvasState,
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
} from "@/lib/types";
import type { DbCanvasState } from "@/lib/database.aliases";

function parseViewport(value: DbCanvasState["viewport"]): Option.Option<Viewport> {
  return Option.flatMap(Option.fromNullable(value), (v) => {
    if (typeof v === "object" && "x" in v && "y" in v && "zoom" in v) {
      const o = v as Viewport;
      return Option.some({ x: o.x, y: o.y, zoom: o.zoom });
    }
    return Option.none();
  });
}

export function canvasFromDb(db: DbCanvasState): CanvasState {
  const nodes = (db.nodes ?? []) as unknown as ReadonlyArray<ReactFlowNode>;
  const edges = (db.edges ?? []) as unknown as ReadonlyArray<ReactFlowEdge>;
  return {
    nodes,
    edges,
    viewport: Option.getOrUndefined(parseViewport(db.viewport)),
  };
}

/**
 * For each edge that does not already have both handles set, compute the best
 * sourceHandle / targetHandle pair based on the relative positions of the
 * source and target nodes. Preserves user-chosen anchor points (connect or
 * reconnect); only resolves when handles are missing (e.g. loaded from DB).
 *
 * Handle-id conventions (must match the Handle ids in AwsNode):
 *   source handles: "top-out" | "bottom-out" | "left-out" | "right-out"
 *   target handles: "top"     | "bottom"     | "left"     | "right"
 */
export function resolveEdgeHandles(
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>,
): ReadonlyArray<ReactFlowEdge> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let changed = false;

  const resolved = edges.map((edge) => {
    // Preserve user-chosen handles when both are already set
    const hasHandles =
      edge.sourceHandle != null &&
      edge.sourceHandle !== "" &&
      edge.targetHandle != null &&
      edge.targetHandle !== "";
    if (hasHandles) return edge;

    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return edge;

    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;

    let sourceHandle: string;
    let targetHandle: string;

    if (Math.abs(dy) >= Math.abs(dx)) {
      // Vertical relationship dominates (ties also prefer vertical)
      if (dy >= 0) {
        sourceHandle = "bottom-out";
        targetHandle = "top";
      } else {
        sourceHandle = "top-out";
        targetHandle = "bottom";
      }
    } else {
      // Horizontal relationship dominates
      if (dx >= 0) {
        sourceHandle = "right-out";
        targetHandle = "left";
      } else {
        sourceHandle = "left-out";
        targetHandle = "right";
      }
    }

    if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) {
      return edge;
    }

    changed = true;
    return { ...edge, sourceHandle, targetHandle };
  });

  return changed ? resolved : edges;
}

export function makeCanvasState(
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>,
  viewport?: Viewport
): CanvasState {
  return { nodes, edges, viewport };
}
