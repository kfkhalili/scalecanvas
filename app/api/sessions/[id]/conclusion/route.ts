import type { Session } from "@/lib/types";
import { Effect, Either } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession } from "@/services/sessions";
import { timeLimitForSession } from "@/lib/chatGuardrails";
import { ConclusionBodySchema } from "@/lib/api.schemas";

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

  const limitMs = timeLimitForSession(session);
  const elapsedMs =
    Date.now() - new Date(session.createdAt).getTime();
  if (elapsedMs < limitMs) {
    return NextResponse.json(
      { error: TIME_NOT_EXPIRED_MESSAGE },
      { status: 403 }
    );
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

  return NextResponse.json({ ok: true });
}
