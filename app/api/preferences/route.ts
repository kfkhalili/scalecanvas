import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { NodeLibraryProviderSchema } from "@/lib/api.schemas";
import {
  getNodeLibraryProvider,
  setNodeLibraryProvider,
} from "@/lib/userPreferences";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const providerOption = await Effect.runPromise(
    getNodeLibraryProvider(supabase, user.id)
  );
  const provider = Option.getOrNull(providerOption);
  return NextResponse.json({ provider });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const parsed = NodeLibraryProviderSchema.safeParse(body.provider);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "provider must be one of: all, aws, gcp, azure, generic" },
      { status: 400 }
    );
  }
  const either = await Effect.runPromise(
    Effect.either(setNodeLibraryProvider(supabase, user.id, parsed.data))
  );
  return Either.match(either, {
    onLeft: (e) =>
      NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: () => NextResponse.json({ ok: true }),
  });
}
