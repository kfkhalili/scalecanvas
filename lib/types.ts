/**
 * Shared app types. Readonly variants used where state is immutable.
 */

export type Session = {
  id: string;
  userId: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TranscriptEntry = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type CanvasState = {
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport?: Viewport;
};

/** Per-session settings (persisted in Supabase). Reserved for future use. */
export type SessionSettings = Record<string, never>;

export type NodeData = {
  label?: string;
};

export type ReactFlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: NodeData;
};

export type EdgeData = {
  label?: string;
  /** Offset from default label position (flow coords) for movable label */
  labelOffsetX?: number;
  labelOffsetY?: number;
};

export type ReactFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: EdgeData;
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

/** Readonly session for use in state/stores */
export type ReadonlySession = Readonly<Session>;

/** Readonly transcript entry */
export type ReadonlyTranscriptEntry = Readonly<TranscriptEntry>;

/** Readonly canvas state */
export type ReadonlyCanvasState = Readonly<CanvasState>;
