import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { createSession, listSessions } from "@/services/sessions";
import { CreateSessionBodySchema } from "@/lib/api.schemas";

export async function GET() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await listSessions(supabase, user.id);
  return result.match(
    (sessions) => NextResponse.json(sessions),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}

export async function POST(request: Request) {
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
  const parsed = CreateSessionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const result = await createSession(supabase, user.id, parsed.data.title ?? null);
  return result.match(
    (session) => NextResponse.json(session, { status: 201 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
