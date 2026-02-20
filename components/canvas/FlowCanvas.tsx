"use client";

import { useCallback, useEffect, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  type NodeChange,
  type EdgeChange,
  type Viewport as RfViewport,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { useCanvasStore } from "@/stores/canvasStore";
import { awsNodeTypes } from "./nodeTypes";
import type { ReactFlowNode, ReactFlowEdge, Viewport } from "@/lib/types";
import { saveCanvasApi } from "@/services/sessionsClient";

function toStoreNode(n: Node): ReactFlowNode {
  return {
    id: n.id,
    type: n.type ?? undefined,
    position: n.position,
    data: n.data as ReactFlowNode["data"],
  };
}

function toStoreEdge(e: Edge): ReactFlowEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  };
}

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
  const {
    nodes,
    edges,
    viewport,
    setNodes,
    setEdges,
    setViewport,
    getCanvasState,
  } = useCanvasStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactFlowInstance = useReactFlow();

  const nodesArray: Node[] = nodes as Node[];
  const edgesArray: Edge[] = edges as Edge[];

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const current = useCanvasStore.getState().nodes;
      const next = applyNodeChanges(changes, current as Node[]);
      setNodes(next.map(toStoreNode));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const current = useCanvasStore.getState().edges;
      const next = applyEdgeChanges(changes, current as Edge[]);
      setEdges(next.map(toStoreEdge));
    },
    [setEdges]
  );

  const onMoveEnd = useCallback(
    (_ev: MouseEvent | TouchEvent | null, vp: RfViewport) => {
      const v: Viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
      setViewport(v);
    },
    [setViewport]
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

      const newNode: ReactFlowNode = {
        id: nextNodeId(),
        type,
        position,
        data: { label },
      };

      const current = useCanvasStore.getState().nodes;
      setNodes([...current, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  useEffect(() => {
    if (!sessionId) return;
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

  return (
    <ReactFlow
      key={sessionId ?? "no-session"}
      nodes={nodesArray}
      edges={edgesArray}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onMoveEnd={onMoveEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      defaultViewport={defaultViewport}
      nodeTypes={awsNodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
    </ReactFlow>
  );
}

type FlowCanvasProps = {
  sessionId: string | null;
};

export function FlowCanvas({ sessionId }: FlowCanvasProps): React.ReactElement {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowCanvasInner sessionId={sessionId} />
      </ReactFlowProvider>
    </div>
  );
}
