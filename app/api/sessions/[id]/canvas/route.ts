import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getCanvasState, saveCanvasState } from "@/services/sessions";
import type { CanvasState } from "@/lib/types";

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
  let body: CanvasState;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return NextResponse.json(
      { error: "nodes and edges must be arrays" },
      { status: 400 }
    );
  }
  const state: CanvasState = {
    nodes: body.nodes,
    edges: body.edges,
    viewport: body.viewport,
  };
  const result = await saveCanvasState(supabase, id, state);
  return result.match(
    () => new NextResponse(null, { status: 204 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
