"use client";

import { useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  addEdge,
  MarkerType,
  type Viewport as RfViewport,
  type Node,
  type Edge,
  type Connection,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useCanvasStore } from "@/stores/canvasStore";
import { awsNodeTypes } from "./nodeTypes";
import { LabeledEdge } from "@/components/canvas/edges/LabeledEdge";
import { EdgeLabelProvider } from "@/components/canvas/edges/EdgeLabelContext";
import { saveCanvasApi } from "@/services/sessionsClient";

const SAVE_DEBOUNCE_MS = 800;

let nodeIdCounter = 0;
function nextNodeId(): string {
  nodeIdCounter += 1;
  return `node-${Date.now()}-${nodeIdCounter}`;
}

type FlowCanvasInnerProps = {
  sessionId: string | null;
};

function FlowCanvasInner({ sessionId }: FlowCanvasInnerProps): React.ReactElement {
  const storeNodes = useCanvasStore((s) => s.nodes);
  const storeEdges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const getCanvasState = useCanvasStore((s) => s.getCanvasState);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const initialNodes = storeNodes as Node[];
  const initialEdges = storeEdges as Edge[];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactFlowInstance = useReactFlow();
  /** Skip store→local sync when we just wrote to the store to avoid update loop. */
  const storeUpdatedFromLocalRef = useRef(false);

  // Sync store -> local only when store was updated externally (e.g. fetchCanvas, session switch)
  useEffect(() => {
    if (storeUpdatedFromLocalRef.current) {
      storeUpdatedFromLocalRef.current = false;
      return;
    }
    setNodes(storeNodes as Node[]);
    setEdges(storeEdges as Edge[]);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // Push local state to store (for save, Evaluate, getCanvasState)
  useEffect(() => {
    storeUpdatedFromLocalRef.current = true;
    setCanvasState({ nodes, edges, viewport });
  }, [nodes, edges, viewport, setCanvasState]);

  const onMoveEnd = useCallback(
    (_ev: MouseEvent | TouchEvent | null, vp: RfViewport) => {
      setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    },
    [setViewport]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prev) => {
        const next = addEdge(connection, prev);
        const prevIds = new Set(prev.map((e) => e.id));
        return next.map((e) =>
          prevIds.has(e.id) ? e : { ...e, data: { ...e.data, label: "" } }
        );
      });
    },
    [setEdges]
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, label } } : e
        )
      );
    },
    [setEdges]
  );

  const updateEdgeLabelPosition = useCallback(
    (edgeId: string, offsetX: number, offsetY: number) => {
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                data: {
                  ...e.data,
                  labelOffsetX: offsetX,
                  labelOffsetY: offsetY,
                },
              }
            : e
        )
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type");
      if (!type) return;
      const label = e.dataTransfer.getData("application/reactflow-label") || type;
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      setNodes((prev) => [
        ...prev,
        { id: nextNodeId(), type, position, data: { label } } as Node,
      ]);
    },
    [reactFlowInstance, setNodes]
  );

  useEffect(() => {
    if (!sessionId || sessionId === "ephemeral") return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const state = getCanvasState();
      saveCanvasApi(sessionId, state).then(() => {});
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [sessionId, nodes, edges, viewport, getCanvasState]);

  const defaultViewport: RfViewport =
    viewport != null
      ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
      : { x: 0, y: 0, zoom: 1 };

  const edgeTypes = useMemo(
    () => ({ default: LabeledEdge }),
    []
  );

  return (
    <EdgeLabelProvider
        updateEdgeLabel={updateEdgeLabel}
        updateEdgeLabelPosition={updateEdgeLabelPosition}
      >
      <ReactFlow
        key={sessionId ?? "no-session"}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        defaultViewport={defaultViewport}
        defaultEdgeOptions={{
          style: { strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { label: "" },
        }}
        edgeTypes={edgeTypes}
        nodeTypes={awsNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </EdgeLabelProvider>
  );
}

type FlowCanvasProps = {
  sessionId: string | null;
};

export function FlowCanvas({ sessionId }: FlowCanvasProps): React.ReactElement {
  const evaluateAction = useCanvasStore((s) => s.evaluateAction);

  return (
    <div
      className="relative h-full w-full"
      style={{ minHeight: 400, minWidth: 300 }}
    >
      <ReactFlowProvider>
        <FlowCanvasInner sessionId={sessionId} />
      </ReactFlowProvider>
      {evaluateAction && (
        <div className="absolute bottom-2 right-2 z-10">
          <button
            type="button"
            onClick={evaluateAction.evaluate}
            disabled={!evaluateAction.canEvaluate || evaluateAction.isEvaluating}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            title={
              evaluateAction.canEvaluate
                ? "Request feedback on the current diagram"
                : "Add or change diagram content to enable"
            }
          >
            {evaluateAction.isEvaluating ? "Evaluating…" : "Evaluate"}
          </button>
        </div>
      )}
    </div>
  );
}
