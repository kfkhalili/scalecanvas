import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { streamText, convertToCoreMessages } from "ai";
import { parseCanvasState } from "@/lib/canvasParser";
import { getSystemPrompt } from "@/lib/prompts";

type ParsedMessage = { role: "user" | "assistant" | "system"; content: string };
type ParsedNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: { label?: string };
};
type ParsedEdge = { id: string; source: string; target: string };

function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part)
          return String((part as { text: string }).text);
        return "";
      })
      .join("");
  }
  return "";
}

function parseChatBody(
  raw: unknown
): { messages: ParsedMessage[]; nodes: ParsedNode[]; edges: ParsedEdge[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawMessages = Array.isArray(o.messages)
    ? o.messages
    : o.data && typeof o.data === "object" && Array.isArray((o.data as Record<string, unknown>).messages)
      ? (o.data as Record<string, unknown[]>).messages
      : undefined;
  if (!rawMessages || rawMessages.length === 0) return null;
  const messages: ParsedMessage[] = [];
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") return null;
    const msg = m as Record<string, unknown>;
    const role = msg.role;
    const content = extractContent(msg.content);
    if (role !== "user" && role !== "assistant" && role !== "system") return null;
    messages.push({ role, content });
  }
  const nodes = parseNodeArray(o.nodes);
  const edges = parseEdgeArray(o.edges);
  return { messages, nodes, edges };
}

function parseNodeArray(v: unknown): ParsedNode[] {
  if (!Array.isArray(v)) return [];
  const out: ParsedNode[] = [];
  for (const n of v) {
    if (!n || typeof n !== "object") continue;
    const x = n as Record<string, unknown>;
    const pos = x.position;
    if (
      typeof x.id !== "string" ||
      !pos ||
      typeof pos !== "object" ||
      typeof (pos as { x: number }).x !== "number" ||
      typeof (pos as { y: number }).y !== "number"
    )
      continue;
    out.push({
      id: x.id,
      type: typeof x.type === "string" ? x.type : undefined,
      position: { x: (pos as { x: number }).x, y: (pos as { y: number }).y },
      data:
        x.data && typeof x.data === "object" && "label" in x.data
          ? { label: (x.data as { label?: string }).label }
          : undefined,
    });
  }
  return out;
}

function parseEdgeArray(v: unknown): ParsedEdge[] {
  if (!Array.isArray(v)) return [];
  const out: ParsedEdge[] = [];
  for (const e of v) {
    if (!e || typeof e !== "object") continue;
    const x = e as Record<string, unknown>;
    if (
      typeof x.id !== "string" ||
      typeof x.source !== "string" ||
      typeof x.target !== "string"
    )
      continue;
    out.push({ id: x.id, source: x.source, target: x.target });
  }
  return out;
}

export async function POST(
  request: Request
): Promise<NextResponse | Response> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[chat] 401 Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let modelId = process.env.BEDROCK_MODEL_ID?.trim();
  const region = process.env.AWS_REGION;
  if (!modelId || !region) {
    console.error("[chat] 503 Missing BEDROCK_MODEL_ID or AWS_REGION");
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: BEDROCK_MODEL_ID and AWS_REGION are required.",
      },
      { status: 503 }
    );
  }
  // Claude Sonnet 4.6 requires an inference profile; raw model ID is not supported for on-demand.
  if (modelId === "anthropic.claude-sonnet-4-6") {
    modelId = "global.anthropic.claude-sonnet-4-6";
  }

  let body: { messages: ParsedMessage[]; nodes: ParsedNode[]; edges: ParsedEdge[] };
  try {
    const raw = await request.json();
    const parsed = parseChatBody(raw);
    if (!parsed) {
      console.error("[chat] 400 Invalid body. Keys:", raw && typeof raw === "object" ? Object.keys(raw as object) : "not object");
      return NextResponse.json(
        { error: "Invalid request body: messages required." },
        { status: 400 }
      );
    }
    body = parsed;
  } catch (e) {
    console.error("[chat] 400 Parse error:", e);
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { messages, nodes, edges } = body;
  const nodesForParser = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data ?? {},
  }));
  const canvasContext = parseCanvasState(nodesForParser, edges);
  const systemPrompt = getSystemPrompt(canvasContext);

  const coreMessages = convertToCoreMessages(
    messages.map((m) => ({ role: m.role, content: m.content }))
  );

  const bedrock = createAmazonBedrock({
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  const model = bedrock(modelId);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
    });
    const response = result.toDataStreamResponse({
      getErrorMessage: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat] stream error:", msg, err);
        return msg;
      },
    });
    // Ensure streaming starts immediately; avoid proxy/runtime buffering.
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Accel-Buffering", "no");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stream from model.";
    console.error("[chat] 502 Bedrock error:", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
