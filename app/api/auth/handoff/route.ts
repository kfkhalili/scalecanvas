import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { claimTrialAndCreateSession } from "@/services/handoff";
import { HandoffBodySchema } from "@/lib/api.schemas";
import { checkRateLimit, HANDOFF_RATE_LIMIT } from "@/lib/rateLimit";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitEither = await Effect.runPromise(
    Effect.either(checkRateLimit(supabase, `handoff:${user.id}`, HANDOFF_RATE_LIMIT))
  );
  if (Either.isLeft(rateLimitEither)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = HandoffBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const either = await Effect.runPromise(
    Effect.either(
      claimTrialAndCreateSession(
        supabase,
        Option.fromNullable(parsed.data.question_title)
      )
    )
  );

  return Either.match(either, {
    onLeft: () => NextResponse.json({ created: false }, { status: 200 }),
    onRight: (sessionId) =>
      NextResponse.json({ created: true, session_id: sessionId }, { status: 201 }),
  });
}
