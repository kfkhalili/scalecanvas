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
  const result = await getCanvasState(supabase, id);
  return result.match(
    (state) => NextResponse.json(state),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
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
  const result = await saveCanvasState(supabase, id, {
    nodes: parsed.data.nodes.map((n) => ({ ...n, data: n.data ?? {} })),
    edges: parsed.data.edges,
    viewport: parsed.data.viewport,
  });
  return result.match(
    () => new NextResponse(null, { status: 204 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
