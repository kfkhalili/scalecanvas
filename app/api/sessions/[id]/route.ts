import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, updateSession, deleteSession } from "@/services/sessions";
import { UpdateSessionBodySchema } from "@/lib/api.schemas";

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
  const result = await getSession(supabase, id);
  return result.match(
    (session) => NextResponse.json(session),
    (e) =>
      NextResponse.json(
        { error: e.message },
        { status: e.message === "Not found" ? 404 : 500 }
      )
  );
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
  const result = await updateSession(supabase, id, { title: parsed.data.title });
  return result.match(
    (session) => NextResponse.json(session),
    (e) =>
      NextResponse.json(
        { error: e.message },
        { status: e.message === "Not found" ? 404 : 500 }
      )
  );
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
  const result = await deleteSession(supabase, id);
  return result.match(
    () => new NextResponse(null, { status: 204 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
