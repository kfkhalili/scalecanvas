import { Effect, Either } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTokenBalance } from "@/services/tokens";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const either = await Effect.runPromise(
    Effect.either(getTokenBalance(supabase, user.id))
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: (tokens) => NextResponse.json({ tokens }),
  });
}
