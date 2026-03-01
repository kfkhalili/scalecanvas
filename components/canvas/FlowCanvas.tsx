"use client";

import { createPortal as _createPortal } from "react-dom";
import { Effect, Option } from "effect";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
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

// Defined at module level so ReactFlow always gets a stable reference (avoids warning #002)
const EDGE_TYPES = { default: LabeledEdge };
import { EdgeLabelProvider } from "@/components/canvas/edges/EdgeLabelContext";
import { saveCanvasApi } from "@/services/sessionsClient";
import {
  getDiagramShortcutEntries,
  computeShortcutsPanelPosition,
} from "@/lib/canvasShortcuts";
import {
  remainingMs,
  getTimerDisplay,
  countdownEffectKey,
  type TimerDisplay,
} from "@/lib/chatGuardrails";
import { HelpCircle, Timer } from "lucide-react";

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
  const isSessionActive = useSessionStore((s) => s.isSessionActive);

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
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

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

  // Push local state to store (for save, Evaluate, getCanvasState). Viewport
  // is read from a ref so we don't depend on it here — it is updated in the
  // store by onMoveEnd; depending on it would cause an infinite loop because
  // setCanvasState produces new Option references.
  useEffect(() => {
    lastPushedNodesRef.current = nodes;
    lastPushedEdgesRef.current = edges;
    setCanvasState({
      nodes,
      edges,
      viewport: Option.getOrUndefined(viewportRef.current),
    });
  }, [nodes, edges, setCanvasState]);

  // Escape: clear selection so the shortcuts-panel hint is accurate
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setNodes((prev) =>
          prev.map((n) => ({ ...n, selected: false }))
        );
        setEdges((prev) =>
          prev.map((edge) => ({ ...edge, selected: false }))
        );
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setNodes, setEdges]);

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
      if (!isSessionActive) return;
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
    [reactFlowInstance, setNodes, isSessionActive]
  );

  useEffect(() => {
    if (!isSessionActive) return;
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
  }, [sessionIdOpt, nodes, edges, viewport, getCanvasState, isSessionActive]);

  const defaultViewport: RfViewport = Option.match(viewport, {
    onNone: () => ({ x: 0, y: 0, zoom: 1 }),
    onSome: (vp) => ({ x: vp.x, y: vp.y, zoom: vp.zoom }),
  });

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
        nodesDraggable={isSessionActive}
        nodesConnectable={isSessionActive}
        elementsSelectable={isSessionActive}
        defaultViewport={defaultViewport}
        defaultEdgeOptions={{
          style: { strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { label: "" },
        }}
        edgeTypes={EDGE_TYPES}
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

/**
 * Countdown badge with zero re-renders while ticking: updates the display
 * imperatively so React doesn't run reconciliation every second. One state
 * update only when the timer elapses (to show the conclusion message).
 */
function InterviewCountdownBadge({
  sessionIdOpt,
}: {
  sessionIdOpt: Option.Option<string>;
}): React.ReactElement | null {
  const sessions = useSessionStore((s) => s.sessions);
  const sessionId = Option.getOrUndefined(sessionIdOpt);
  const session =
    sessionId && sessionId !== "ephemeral"
      ? sessions.find((s) => s.id === sessionId)
      : undefined;
  const sessionRef = useRef(session);
  const labelRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(false);
  const effectKey = countdownEffectKey(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    const s = sessionRef.current;
    if (!s || !effectKey) return;
    const apply = (next: TimerDisplay): void => {
      if (containerRef.current)
        containerRef.current.setAttribute(
          "aria-label",
          next.isElapsed
            ? (next.elapsedMessage ?? "Time has elapsed")
            : `Time left: ${next.timeLabel}`
        );
      if (labelRef.current)
        labelRef.current.textContent = next.isElapsed
          ? next.timeLabel
          : `Time left: ${next.timeLabel}`;
      if (next.isElapsed) setElapsed(true);
    };
    const current = getTimerDisplay(remainingMs(s));
    apply(current);
    if (current.isElapsed) return;
    const interval = setInterval(() => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const next = getTimerDisplay(remainingMs(currentSession));
      apply(next);
      if (next.isElapsed) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [effectKey]);
  if (!session) return null;
  const initial = getTimerDisplay(remainingMs(session));
  return (
    <div
      ref={containerRef}
      className="absolute left-2 top-2 z-10 flex flex-col gap-0.5 rounded-md border border-input bg-background/95 px-2 py-1.5 text-xs text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-live="polite"
      aria-label={
        initial.isElapsed
          ? (initial.elapsedMessage ?? "Time has elapsed")
          : `Time left: ${initial.timeLabel}`
      }
    >
      <div className="flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span ref={labelRef}>
          {initial.isElapsed
            ? initial.timeLabel
            : `Time left: ${initial.timeLabel}`}
        </span>
      </div>
      {(elapsed || initial.isElapsed) && initial.elapsedMessage ? (
        <span className="text-muted-foreground">{initial.elapsedMessage}</span>
      ) : null}
    </div>
  );
}

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
        setPanelPosition(
          computeShortcutsPanelPosition(rect, window.innerHeight)
        );
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
              {getDiagramShortcutEntries().map((entry, i) => (
                <li key={i}>
                  {entry.keys.map((key, j) => (
                    <span key={j}>
                      {j > 0 ? " + " : null}
                      <kbd className="rounded border border-border bg-muted px-1 font-mono">
                        {key}
                      </kbd>
                    </span>
                  ))}
                  {" — "}
                  {entry.description}
                </li>
              ))}
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
      <InterviewCountdownBadge sessionIdOpt={sessionIdOpt} />
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
