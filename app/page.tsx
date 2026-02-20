import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createSession } from "@/services/sessions";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

export default async function RootPage() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const result = await createSession(supabase, user.id);
    return result.match(
      (session) => redirect(`/${session.id}`),
      () => redirect("/login")
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous />
      </div>
    </main>
  );
}
