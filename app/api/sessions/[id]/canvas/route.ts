import { Effect, Either } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getCanvasState, saveCanvasState } from "@/services/sessions";
import { CanvasBodySchema } from "@/lib/api.schemas";

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
    Effect.either(getCanvasState(supabase, id))
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: (state) => NextResponse.json(state),
  });
}

export async function PUT(request: Request, { params }: Params) {
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
  const parsed = CanvasBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const either = await Effect.runPromise(
    Effect.either(
      saveCanvasState(supabase, id, {
        nodes: parsed.data.nodes.map((n) => ({ ...n, data: n.data ?? {} })),
        edges: parsed.data.edges,
        viewport: parsed.data.viewport,
      })
    )
  );
  return Either.match(either, {
    onLeft: (e) => NextResponse.json({ error: e.message }, { status: 500 }),
    onRight: () => new NextResponse(null, { status: 204 }),
  });
}
