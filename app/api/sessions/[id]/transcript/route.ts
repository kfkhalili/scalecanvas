import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTranscript, appendTranscriptEntry } from "@/services/sessions";

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
  const result = await getTranscript(supabase, id);
  return result.match(
    (entries) => NextResponse.json(entries),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { role: "user" | "assistant"; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body.role !== "string" ||
    (body.role !== "user" && body.role !== "assistant") ||
    typeof body.content !== "string"
  ) {
    return NextResponse.json(
      { error: "role must be 'user' or 'assistant', content must be string" },
      { status: 400 }
    );
  }
  const result = await appendTranscriptEntry(
    supabase,
    id,
    body.role,
    body.content
  );
  return result.match(
    (entry) => NextResponse.json(entry, { status: 201 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
