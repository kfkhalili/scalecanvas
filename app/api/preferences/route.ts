import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { NodeLibraryProvidersSchema } from "@/lib/api.schemas";
import { createServerClientInstance } from "@/lib/supabase/server";
import {
  getNodeLibraryProviders,
  setNodeLibraryProviders,
} from "@/lib/userPreferences";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const providerOpt = await Effect.runPromise(
    getNodeLibraryProviders(supabase, user.id)
  );
  const providers = Option.getOrElse(providerOpt, () => []);
  return NextResponse.json({ providers });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { providers?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const parsed = NodeLibraryProvidersSchema.safeParse(body.providers);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "providers must be an array; each item must be aws, gcp, azure, or generic (no 'all')",
      },
      { status: 400 }
    );
  }
  const either = await Effect.runPromise(
    Effect.either(setNodeLibraryProviders(supabase, user.id, parsed.data))
  );
  return Either.match(either, {
    onLeft: (e) =>
      NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: () => NextResponse.json({ ok: true }),
  });
}
