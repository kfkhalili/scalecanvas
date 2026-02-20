import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function SessionPage({ params }: PageProps) {
  const { sessionId } = await params;

  if (!UUID_RE.test(sessionId)) {
    notFound();
  }

  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView sessionId={sessionId} />
      </div>
    </main>
  );
}
