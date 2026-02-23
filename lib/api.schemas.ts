import { z } from "zod";

export const CreateSessionBodySchema = z.object({
  title: z.string().nullable().optional(),
});

export const UpdateSessionBodySchema = z.object({
  title: z.string().nullable(),
});

export const AppendTranscriptBodySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(50_000),
});

const NodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
});

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  data: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
});

export const MAX_NODES = 200;
export const MAX_EDGES = 500;

export const CanvasBodySchema = z.object({
  nodes: z.array(NodeSchema).max(MAX_NODES),
  edges: z.array(EdgeSchema).max(MAX_EDGES),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([
    z.string(),
    z.array(
      z.object({ text: z.string() }).passthrough()
    ),
  ]),
});

export const MAX_MESSAGES = 100;
export const MAX_CONTENT_LENGTH = 10_000;

/** Max request body size for POST /api/chat (bytes). */
export const MAX_CHAT_BODY_BYTES = 1_000_000;

/** session_id must be a valid UUID when provided (interview_sessions.id). */
export const SESSION_ID_MAX_LENGTH = 128;

export const ChatBodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
  nodes: z.array(NodeSchema).max(MAX_NODES).optional().default([]),
  edges: z.array(EdgeSchema).max(MAX_EDGES).optional().default([]),
  session_id: z.string().uuid().max(SESSION_ID_MAX_LENGTH).optional(),
  data: z
    .object({
      messages: z.array(MessageSchema).optional(),
    })
    .optional(),
});

export const CheckoutBodySchema = z.object({
  pack_id: z.string().min(1),
});

export const HandoffBodySchema = z.object({
  question_title: z.string().nullable().optional(),
});

export type HandoffSuccessResponse = { created: true; session_id: string };
export type HandoffNotCreatedResponse = { created: false };
export type HandoffResponse = HandoffSuccessResponse | HandoffNotCreatedResponse;

export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;
export type UpdateSessionBody = z.infer<typeof UpdateSessionBodySchema>;
export type AppendTranscriptBody = z.infer<typeof AppendTranscriptBodySchema>;
export type CanvasBody = z.infer<typeof CanvasBodySchema>;
export type ChatBody = z.infer<typeof ChatBodySchema>;
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;
export type HandoffBody = z.infer<typeof HandoffBodySchema>;
