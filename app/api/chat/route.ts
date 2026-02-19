import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";

/**
 * Chat API stub for Phase 5. Phase 6 will add auth, body parsing, and Bedrock streaming.
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Chat API will be available in Phase 6 (Bedrock streaming)." },
    { status: 501 }
  );
}
