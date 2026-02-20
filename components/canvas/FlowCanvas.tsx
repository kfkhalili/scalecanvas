"use client";

import { useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  addEdge,
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

  // Sync store -> local state when store updates (e.g. after fetchCanvas on load or session switch)
  useEffect(() => {
    setNodes(storeNodes as Node[]);
    setEdges(storeEdges as Edge[]);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  useEffect(() => {
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
    <EdgeLabelProvider updateEdgeLabel={updateEdgeLabel}>
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
  return (
    <div className="h-full w-full" style={{ minHeight: 400, minWidth: 300 }}>
      <ReactFlowProvider>
        <FlowCanvasInner sessionId={sessionId} />
      </ReactFlowProvider>
    </div>
  );
}
