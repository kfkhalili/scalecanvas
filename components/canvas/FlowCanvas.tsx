"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type NodeChange,
  type EdgeChange,
  type Viewport as RfViewport,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
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

type FlowCanvasProps = {
  sessionId: string | null;
};

export function FlowCanvas({ sessionId }: FlowCanvasProps): React.ReactElement {
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
    (_ev: MouseEvent | TouchEvent | null, viewport: RfViewport) => {
      const v: Viewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      };
      setViewport(v);
    },
    [setViewport]
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
    <div className="h-full w-full">
      <ReactFlow
        key={sessionId ?? "no-session"}
        nodes={nodesArray}
        edges={edgesArray}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={onMoveEnd}
        defaultViewport={defaultViewport}
        nodeTypes={awsNodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
