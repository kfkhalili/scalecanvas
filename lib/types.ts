/**
 * Shared app types. Readonly variants used where state is immutable.
 */

import type { z } from "zod";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type { NodeLibraryProviderSchema } from "@/lib/api.schemas";

export type Session = {
  id: string;
  userId: string;
  title: string | null;
  status: string;
  isTrial: boolean;
  createdAt: string;
  updatedAt: string;
  /** Set once when time-expired or voluntary conclusion summary is generated. */
  conclusionSummary: string | null;
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

/** Typed alias for Node<NodeData> from @xyflow/react — backed by the library to prevent drift. */
export type ReactFlowNode = Node<NodeData>;

export type EdgeData = {
  label?: string;
  /** Offset from default label position (flow coords) for movable label */
  labelOffsetX?: number;
  labelOffsetY?: number;
};

/** Typed alias for Edge<EdgeData> from @xyflow/react — backed by the library to prevent drift. */
export type ReactFlowEdge = Edge<EdgeData>;

/** Re-exported from @xyflow/react — { x, y, zoom }. */
export type { Viewport };

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
