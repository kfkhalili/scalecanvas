import { Effect, Either } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import {
  getSessionSettings,
  saveSessionSettings,
} from "@/services/sessions";
import type { SessionSettings } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const either = await Effect.runPromise(
    Effect.either(getSessionSettings(supabase, id))
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: (settings) => NextResponse.json(settings),
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
  try {
    await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const getEither = await Effect.runPromise(
    Effect.either(getSessionSettings(supabase, id))
  );
  if (Either.isLeft(getEither)) {
    return NextResponse.json(
      { error: getEither.left.message },
      { status: 500 }
    );
  }
  const settings: SessionSettings = {};
  const saveEither = await Effect.runPromise(
    Effect.either(saveSessionSettings(supabase, id, settings))
  );
  return Either.match(saveEither, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: () => NextResponse.json(settings),
  });
}
