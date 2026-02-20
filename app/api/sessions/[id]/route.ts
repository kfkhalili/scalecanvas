import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getSession, updateSession, deleteSession } from "@/services/sessions";

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
  let body: { title?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.title !== "string" && body.title !== null) {
    return NextResponse.json(
      { error: "title must be a string or null" },
      { status: 400 }
    );
  }
  const result = await updateSession(supabase, id, { title: body.title });
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
