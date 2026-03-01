import type { Session } from "@/lib/types";
import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages } from "ai";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, updateSession } from "@/services/sessions";
import { timeLimitForSession } from "@/lib/chatGuardrails";
import { ConclusionBodySchema } from "@/lib/api.schemas";
import { parseCanvasState } from "@/lib/canvasParser";
import { getSystemPromptConclusionTimeExpired } from "@/lib/prompts";
import { extractContent } from "@/lib/chatHelpers";
import { getBedrockModel } from "@/lib/bedrock";

type Params = { params: Promise<{ id: string }> };

const TIME_NOT_EXPIRED_MESSAGE =
  "Time has not expired. You cannot request the final summary yet.";
const ALREADY_GENERATED_MESSAGE =
  "Final summary was already generated for this session.";

export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionEither = await Effect.runPromise(
    Effect.either(getSession(supabase, sessionId))
  );
  const sessionOrError = Either.match(sessionEither, {
    onLeft: (e) =>
      NextResponse.json(
        { error: e.message },
        { status: 403 }
      ) as NextResponse | Session,
    onRight: (s) => s,
  });
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const session = sessionOrError;
  if (session.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.conclusionSummary !== null && session.conclusionSummary !== "") {
    return NextResponse.json(
      { error: ALREADY_GENERATED_MESSAGE },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ConclusionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  const limitMs = timeLimitForSession(session);
  const elapsedMs =
    Date.now() - new Date(session.createdAt).getTime();
  const simulateExpired = parsed.data.simulate_expired === true;
  const allowSimulate =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SIMULATE_EXPIRED === "true";
  const userRequestedEnd = parsed.data.user_requested_end === true;
  if (!userRequestedEnd && !(simulateExpired && allowSimulate) && elapsedMs < limitMs) {
    return NextResponse.json(
      { error: TIME_NOT_EXPIRED_MESSAGE },
      { status: 403 }
    );
  }

  const bedrockResult = getBedrockModel();
  if (!bedrockResult.success) {
    return NextResponse.json({ error: bedrockResult.error }, { status: 503 });
  }
  const model = bedrockResult.model;

  const nodesForParser = parsed.data.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data ?? {},
  }));
  const canvasContext = parseCanvasState(nodesForParser, parsed.data.edges);
  const systemPrompt = getSystemPromptConclusionTimeExpired(canvasContext);
  const parsedMessages = parsed.data.messages.map((m) => ({
    role: m.role,
    content: extractContent(m.content),
  }));
  const lastRole = parsedMessages.length > 0 ? parsedMessages[parsedMessages.length - 1]?.role : undefined;
  const messagesForModel =
    lastRole === "user"
      ? parsedMessages
      : [
          ...parsedMessages,
          {
            role: "user" as const,
            content:
              "The time has expired. Please provide your final summary and feedback.",
          },
        ];
  const coreMessages = convertToCoreMessages(messagesForModel);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      onFinish: async ({ text }) => {
        const currentEither = await Effect.runPromise(
          Effect.either(getSession(supabase, sessionId))
        );
        if (
          Either.isRight(currentEither) &&
          (currentEither.right.conclusionSummary === null ||
            currentEither.right.conclusionSummary === "")
        ) {
          await Effect.runPromise(
            Effect.either(
              updateSession(supabase, sessionId, user.id, {
                conclusionSummaryOpt: Option.some(text),
              })
            )
          );
        }
      },
    });
    const response = result.toDataStreamResponse({
      getErrorMessage: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[conclusion] stream error:", msg, err);
        return msg;
      },
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Accel-Buffering", "no");
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to stream from model.";
    console.error("[conclusion] 502 Bedrock error:", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
