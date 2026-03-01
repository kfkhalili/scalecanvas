import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { createSession, listSessions } from "@/services/sessions";
import { CreateSessionBodySchema } from "@/lib/api.schemas";
import { checkRateLimit, SESSIONS_RATE_LIMIT } from "@/lib/rateLimit";

export async function GET() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const either = await Effect.runPromise(
    Effect.either(listSessions(supabase, user.id))
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: (sessions) => NextResponse.json(sessions),
  });
}

export async function POST(request: Request) {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rateLimitEither = await Effect.runPromise(
    Effect.either(checkRateLimit(supabase, `sessions:${user.id}`, SESSIONS_RATE_LIMIT))
  );
  if (Either.isLeft(rateLimitEither)) {
    const limited = rateLimitEither.left;
    const resetMs = new Date(limited.resetAt).getTime() - Date.now();
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(resetMs / 1000))) },
      }
    );
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSessionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const either = await Effect.runPromise(
    Effect.either(
      createSession(supabase, user.id, Option.fromNullable(parsed.data.title))
    )
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: (session) => NextResponse.json(session, { status: 201 }),
  });
}
