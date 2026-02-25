import { Option } from "effect";
import type {
  CanvasState,
  ReactFlowNode,
  ReactFlowEdge,
  Viewport,
} from "@/lib/types";
import type { DbCanvasState } from "@/lib/database.aliases";

/** Sample nodes and edges shown when the canvas would otherwise be empty. */
export function getSampleCanvasState(): CanvasState {
  const nodes: ReactFlowNode[] = [
    { id: "sample-client", type: "awsVpc", position: { x: 250, y: 0 }, data: { label: "Client" } },
    { id: "sample-api", type: "awsApiGateway", position: { x: 250, y: 120 }, data: { label: "API Gateway" } },
    { id: "sample-lambda", type: "awsLambda", position: { x: 250, y: 240 }, data: { label: "Auth Handler" } },
    { id: "sample-db", type: "awsDynamodb", position: { x: 250, y: 360 }, data: { label: "User Data" } },
    { id: "sample-s3", type: "awsS3", position: { x: 480, y: 240 }, data: { label: "Assets" } },
  ];
  const edges: ReactFlowEdge[] = [
    { id: "e1", source: "sample-client", target: "sample-api" },
    { id: "e2", source: "sample-api", target: "sample-lambda" },
    { id: "e3", source: "sample-lambda", target: "sample-db" },
    { id: "e4", source: "sample-lambda", target: "sample-s3" },
  ];
  return { nodes, edges };
}

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

export function replaceCanvasState(
  _current: CanvasState,
  nodes: ReadonlyArray<ReactFlowNode>,
  edges: ReadonlyArray<ReactFlowEdge>,
  viewport?: Viewport
): CanvasState {
  return { nodes, edges, viewport };
}
