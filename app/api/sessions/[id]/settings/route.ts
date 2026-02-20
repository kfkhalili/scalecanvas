import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import {
  getSessionSettings,
  saveSessionSettings,
} from "@/services/sessions";
import type { SessionSettings } from "@/lib/types";

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
  const result = await getSessionSettings(supabase, id);
  return result.match(
    (settings) => NextResponse.json(settings),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
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
  let body: Partial<SessionSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await getSessionSettings(supabase, id);
  if (result.isErr()) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }
  const current = result.value;
  const settings: SessionSettings = {
    autoReviewEnabled:
      typeof body.autoReviewEnabled === "boolean"
        ? body.autoReviewEnabled
        : current.autoReviewEnabled,
  };
  const saveResult = await saveSessionSettings(supabase, id, settings);
  return saveResult.match(
    () => NextResponse.json(settings),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
