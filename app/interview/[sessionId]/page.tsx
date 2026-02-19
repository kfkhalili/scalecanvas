import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function InterviewSessionPage({ params }: PageProps) {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { sessionId } = await params;
  return (
    <main className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b px-4 py-2">
        <Link href="/interview" className="text-sm text-muted-foreground hover:underline">
          ← Sessions
        </Link>
        <span className="text-sm font-medium">Session</span>
      </header>
      <div className="min-h-0 flex-1">
        <InterviewSplitView sessionId={sessionId} />
      </div>
    </main>
  );
}
