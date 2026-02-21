import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTranscript, appendTranscriptEntry } from "@/services/sessions";
import { AppendTranscriptBodySchema } from "@/lib/api.schemas";

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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = AppendTranscriptBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const result = await appendTranscriptEntry(
    supabase,
    id,
    parsed.data.role,
    parsed.data.content
  );
  return result.match(
    (entry) => NextResponse.json(entry, { status: 201 }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
