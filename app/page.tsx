import { createServerClientInstance } from "@/lib/supabase/server";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";
import { PostAuthRoot } from "@/components/PostAuthRoot";

export default async function RootPage() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return <PostAuthRoot />;
  }

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous />
      </div>
    </main>
  );
}
