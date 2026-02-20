import type {
  CanvasState,
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
} from "@/lib/types";
import type { DbCanvasState } from "@/lib/database.types";

/** Sample nodes and edges shown when the canvas would otherwise be empty. */
export function getSampleCanvasState(): CanvasState {
  const nodes: ReactFlowNode[] = [
    { id: "sample-client", type: "vpc", position: { x: 250, y: 0 }, data: { label: "Client" } },
    { id: "sample-api", type: "apiGateway", position: { x: 250, y: 120 }, data: { label: "API Gateway" } },
    { id: "sample-lambda", type: "lambda", position: { x: 250, y: 240 }, data: { label: "Auth Handler" } },
    { id: "sample-db", type: "dynamodb", position: { x: 250, y: 360 }, data: { label: "User Data" } },
    { id: "sample-s3", type: "s3", position: { x: 480, y: 240 }, data: { label: "Assets" } },
  ];
  const edges: ReactFlowEdge[] = [
    { id: "e1", source: "sample-client", target: "sample-api" },
    { id: "e2", source: "sample-api", target: "sample-lambda" },
    { id: "e3", source: "sample-lambda", target: "sample-db" },
    { id: "e4", source: "sample-lambda", target: "sample-s3" },
  ];
  return { nodes, edges };
}

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
