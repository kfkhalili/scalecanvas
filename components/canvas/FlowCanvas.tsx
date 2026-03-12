"use client";

import { createPortal as _createPortal } from "react-dom";
import { Option } from "effect";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  MarkerType,
  type Viewport as RfViewport,
  type Node,
  type Edge,
  type Connection,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { canInteract } from "@/lib/workspacePhase";
import { awsNodeTypes } from "./nodeTypes";
import { LabeledEdge } from "@/components/canvas/edges/LabeledEdge";
import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

// Defined at module level so ReactFlow always gets a stable reference (avoids warning #002)
const EDGE_TYPES = { default: LabeledEdge };
import { EdgeLabelProvider } from "@/components/canvas/edges/EdgeLabelContext";
import { getPersistence } from "@/lib/persistenceLifecycle";
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

type FlowCanvasInnerProps = {
  sessionIdOpt: Option.Option<string>;
};

function FlowCanvasInner({ sessionIdOpt }: FlowCanvasInnerProps): React.ReactElement {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const connectNodes = useCanvasStore((s) => s.connectNodes);
  const doReconnectEdge = useCanvasStore((s) => s.doReconnectEdge);
  const updateEdgeLabel = useCanvasStore((s) => s.updateEdgeLabel);
  const updateEdgeLabelPosition = useCanvasStore((s) => s.updateEdgeLabelPosition);
  const addNodeAction = useCanvasStore((s) => s.addNode);
  const deselectAll = useCanvasStore((s) => s.deselectAll);
  const isSessionActive = useWorkspaceStore((s) => canInteract(s.phase));

  const reactFlowInstance = useReactFlow();

  // Escape: clear selection so the shortcuts-panel hint is accurate
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") deselectAll();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deselectAll]);

  const onMoveEnd = useCallback(
    (_ev: MouseEvent | TouchEvent | null, vp: RfViewport) => {
      setViewport(Option.some({ x: vp.x, y: vp.y, zoom: vp.zoom }));
    },
    [setViewport]
  );

  const onConnect = useCallback(
    (connection: Connection) => connectNodes(connection),
    [connectNodes]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) =>
      doReconnectEdge(oldEdge as ReactFlowEdge, newConnection),
    [doReconnectEdge]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (!canInteract(useWorkspaceStore.getState().phase)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      // Read directly from the store to avoid stale closure between zustand
      // update and React re-render (the useCallback dep array only refreshes
      // on the next render commit).
      if (!canInteract(useWorkspaceStore.getState().phase)) return;
      const type = e.dataTransfer.getData("application/reactflow-type");
      if (!type) return;
      const label = e.dataTransfer.getData("application/reactflow-label") || type;
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      addNodeAction({ id: crypto.randomUUID(), type, position, data: { label } } as ReactFlowNode);
    },
    [reactFlowInstance, addNodeAction]
  );

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
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
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
  const isSessionActive = useWorkspaceStore((s) => canInteract(s.phase));
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
  /** When user ends interview early, show 0:00 and stop ticking. */
  const treatAsElapsed = !isSessionActive;
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
    const current = treatAsElapsed
      ? getTimerDisplay(0)
      : getTimerDisplay(remainingMs(s));
    apply(current);
    if (current.isElapsed) return;
    const interval = setInterval(() => {
      if (treatAsElapsed) {
        apply(getTimerDisplay(0));
        return;
      }
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const next = getTimerDisplay(remainingMs(currentSession));
      apply(next);
      if (next.isElapsed) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [effectKey, treatAsElapsed]);
  if (!session) return null;
  const initial = treatAsElapsed
    ? getTimerDisplay(0)
    : getTimerDisplay(remainingMs(session));
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
  const isSessionActive = useWorkspaceStore((s) => canInteract(s.phase));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Subscribe to persistence state for the data-save-status attribute.
  const [saveStatus, setSaveStatus] = useState<string>("idle");
  useEffect(() => {
    const update = (): void => {
      const s = getPersistence().getState();
      const status = s.isSaving ? "saving" : s.error ? "error" : s.isDirty ? "dirty" : "saved";
      setSaveStatus(status);
    };
    update();
    return getPersistence().subscribe(update);
  }, []);

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
      data-save-status={saveStatus}
      data-read-only={!isSessionActive}
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
