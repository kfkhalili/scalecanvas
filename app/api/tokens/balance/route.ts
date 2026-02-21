import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getTokenBalance } from "@/services/tokens";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await getTokenBalance(supabase, user.id);
  return result.match(
    (tokens) => NextResponse.json({ tokens }),
    (e) => NextResponse.json({ error: e.message }, { status: 500 })
  );
}
