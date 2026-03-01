import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, updateSession, deleteSession } from "@/services/sessions";
import { UpdateSessionBodySchema } from "@/lib/api.schemas";

type Params = { params: Promise<{ id: string }> };

function statusForMessage(message: string): number {
  return message === "Not found" ? 404 : 500;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const either = await Effect.runPromise(Effect.either(getSession(supabase, id)));
  return Either.match(either, {
    onLeft: (e) =>
      NextResponse.json({ error: e.message }, { status: statusForMessage(e.message) }),
    onRight: (session) => NextResponse.json(session),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = UpdateSessionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const either = await Effect.runPromise(
    Effect.either(
      updateSession(supabase, id, user.id, {
        titleOpt: Option.fromNullable(parsed.data.title),
      })
    )
  );
  return Either.match(either, {
    onLeft: (e) =>
      NextResponse.json({ error: e.message }, { status: statusForMessage(e.message) }),
    onRight: (session) => NextResponse.json(session),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const either = await Effect.runPromise(
    Effect.either(deleteSession(supabase, id, user.id))
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: () => new NextResponse(null, { status: 204 }),
  });
}
