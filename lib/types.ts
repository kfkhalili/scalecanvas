/**
 * Shared app types. Readonly variants used where state is immutable.
 */

import type { z } from "zod";
import type { NodeLibraryProviderSchema } from "@/lib/api.schemas";

export type Session = {
  id: string;
  userId: string;
  title: string | null;
  status: string;
  isTrial: boolean;
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

/** Node library filter: single cloud provider or generic. */
export type NodeLibraryProvider = z.infer<typeof NodeLibraryProviderSchema>;

/** Key for the node library provider preference in user_preferences. */
export const NODE_LIBRARY_PROVIDER_KEY = "node_library_provider" as const;
