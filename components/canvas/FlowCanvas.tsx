"use client";

import { createPortal as _createPortal } from "react-dom";
import { Effect, Option } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  addEdge,
  reconnectEdge,
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
import { useSessionStore } from "@/stores/sessionStore";
import { whenSome } from "@/lib/optionHelpers";
import { awsNodeTypes } from "./nodeTypes";
import { LabeledEdge } from "@/components/canvas/edges/LabeledEdge";
import { EdgeLabelProvider } from "@/components/canvas/edges/EdgeLabelContext";
import { saveCanvasApi } from "@/services/sessionsClient";
import { HelpCircle } from "lucide-react";

const SAVE_DEBOUNCE_MS = 800;

type FlowCanvasInnerProps = {
  sessionIdOpt: Option.Option<string>;
};

function FlowCanvasInner({ sessionIdOpt }: FlowCanvasInnerProps): React.ReactElement {
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

  /**
   * Track the exact node/edge references we last pushed to the store so we can
   * tell whether a store change was caused by us (local→store) or externally
   * (fetchCanvas, session switch, rehydrate). A simple boolean flag doesn't
   * work because it can't survive interleaved async updates (e.g. fetchCanvas
   * resolving after the initial local→store sync on mount).
   */
  const lastPushedNodesRef = useRef<readonly Node[] | null>(null);
  const lastPushedEdgesRef = useRef<readonly Edge[] | null>(null);

  // Sync store -> local only when store was updated externally (e.g. fetchCanvas, session switch)
  useEffect(() => {
    // Skip when the store still holds exactly what we wrote — avoids
    // store→local→store echo loop while letting external updates through.
    if (
      storeNodes === lastPushedNodesRef.current &&
      storeEdges === lastPushedEdgesRef.current
    ) {
      return;
    }
    setNodes(storeNodes as Node[]);
    setEdges(storeEdges as Edge[]);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // Push local state to store (for save, Evaluate, getCanvasState)
  useEffect(() => {
    lastPushedNodesRef.current = nodes;
    lastPushedEdgesRef.current = edges;
    setCanvasState({
      nodes,
      edges,
      viewport: Option.getOrUndefined(viewport),
    });
    // Note: `viewport` is intentionally excluded from deps — it is pushed to
    // the store via its own `setViewport` call in `onMoveEnd`.  Including it
    // here creates an infinite loop because `setCanvasState` wraps the value
    // with `Option.fromNullable`, producing a new reference on every call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, setCanvasState]);

  const onMoveEnd = useCallback(
    (_ev: MouseEvent | TouchEvent | null, vp: RfViewport) => {
      setViewport(Option.some({ x: vp.x, y: vp.y, zoom: vp.zoom }));
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

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((prev) => {
        const next = reconnectEdge(oldEdge, newConnection, prev);
        return next.map((e) =>
          e.id === oldEdge.id ? { ...e, data: { ...e.data, ...oldEdge.data } } : e
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
        { id: crypto.randomUUID(), type, position, data: { label } } as Node,
      ]);
    },
    [reactFlowInstance, setNodes]
  );

  useEffect(() => {
    whenSome(sessionIdOpt, (sessionId) => {
      if (sessionId === "ephemeral") return;
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const state = getCanvasState();
        void Effect.runPromise(
          Effect.either(saveCanvasApi(sessionId, state))
        ).then(() => {});
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sessionIdOpt, nodes, edges, viewport, getCanvasState]);

  const defaultViewport: RfViewport = Option.match(viewport, {
    onNone: () => ({ x: 0, y: 0, zoom: 1 }),
    onSome: (vp) => ({ x: vp.x, y: vp.y, zoom: vp.zoom }),
  });

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
        key={Option.getOrElse(sessionIdOpt, () => "no-session")}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
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
        fitView={Option.isNone(viewport)}
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </EdgeLabelProvider>
  );
}

type FlowCanvasProps = {
  sessionIdOpt: Option.Option<string>;
};

export function FlowCanvas({ sessionIdOpt }: FlowCanvasProps): React.ReactElement {
  const evaluateActionOpt = useCanvasStore((s) => s.evaluateAction);
  const isSessionActive = useSessionStore((s) => s.isSessionActive);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const close = (e: MouseEvent): void => {
      if (helpBtnRef.current?.contains(e.target as globalThis.Node)) return;
      if (helpPanelRef.current?.contains(e.target as globalThis.Node)) return;
      setShortcutsOpen(false);
      setPanelPosition(null);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [shortcutsOpen]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const close = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setShortcutsOpen(false);
        setPanelPosition(null);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [shortcutsOpen]);

  const toggleShortcuts = useCallback(() => {
    const nextOpen = !shortcutsOpen;
    if (nextOpen) {
      const rect = helpBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setPanelPosition({
          bottom: window.innerHeight - rect.top + 8,
          left: rect.left,
        });
      }
    } else {
      setPanelPosition(null);
    }
    setShortcutsOpen(nextOpen);
  }, [shortcutsOpen]);

  const shortcutsPanel =
    shortcutsOpen && panelPosition
      ? _createPortal(
          <div
            ref={helpPanelRef}
            role="dialog"
            aria-label="Diagram shortcuts"
            className="fixed z-[200] w-64 rounded-xl border bg-popover p-3 shadow-xl"
            style={{ bottom: panelPosition.bottom, left: panelPosition.left }}
          >
            <div className="mb-2 text-sm font-medium text-foreground">
              Diagram shortcuts
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground" aria-label="Shortcut list">
              <li>
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Shift</kbd>
                {" + "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono">drag</kbd>
                {" — Select multiple (box select)"}
              </li>
              <li>
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Drag</kbd>
                {" — Pan"}
              </li>
              <li>
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Scroll</kbd>
                {" — Zoom"}
              </li>
              <li>
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Escape</kbd>
                {" — Clear selection"}
              </li>
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="relative h-full w-full"
      style={{ minHeight: 400, minWidth: 300 }}
    >
      {shortcutsPanel}
      <ReactFlowProvider>
        <FlowCanvasInner sessionIdOpt={sessionIdOpt} />
      </ReactFlowProvider>
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-2">
        <button
          type="button"
          ref={helpBtnRef}
          onClick={toggleShortcuts}
          aria-label="Canvas shortcuts"
          aria-expanded={shortcutsOpen}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        {Option.match(evaluateActionOpt, {
          onNone: () => null,
          onSome: (evaluateAction) => (
            <button
              type="button"
              onClick={evaluateAction.evaluate}
              disabled={!evaluateAction.canEvaluate || evaluateAction.isEvaluating || !isSessionActive}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              title={
                !isSessionActive
                  ? "Interview ended"
                  : evaluateAction.canEvaluate
                    ? "Request feedback on the current diagram"
                    : "Add or change diagram content to enable"
              }
            >
              {evaluateAction.isEvaluating ? "Evaluating…" : "Evaluate"}
            </button>
          ),
        })}
      </div>
    </div>
  );
}
