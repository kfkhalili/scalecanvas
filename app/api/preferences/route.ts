import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClientInstance } from "@/lib/supabase/server";
import {
  getNodeLibraryProvider,
  setNodeLibraryProvider,
} from "@/lib/userPreferences";

const NodeLibraryProviderSchema = z.enum([
  "all",
  "aws",
  "gcp",
  "azure",
  "generic",
]);

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const provider = await getNodeLibraryProvider(supabase, user.id);
  return NextResponse.json({ provider });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const parsed = NodeLibraryProviderSchema.safeParse(body.provider);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "provider must be one of: all, aws, gcp, azure, generic" },
      { status: 400 }
    );
  }
  const result = await setNodeLibraryProvider(supabase, user.id, parsed.data);
  return result.match(
    () => NextResponse.json({ ok: true }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
