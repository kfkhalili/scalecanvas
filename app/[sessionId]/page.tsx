import { Effect, Either } from "effect";
import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";
import { getSession } from "@/services/sessions";

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
    redirect("/");
  }

  const sessionEither = await Effect.runPromise(
    Effect.either(getSession(supabase, sessionId))
  );
  const isTrial = Either.match(sessionEither, {
    onLeft: () => false,
    onRight: (session) => session.isTrial,
  });
  const isConcluded = Either.match(sessionEither, {
    onLeft: () => false,
    onRight: (session) =>
      session.conclusionSummary !== null && session.conclusionSummary !== "",
  });

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView sessionId={sessionId} isTrial={isTrial} isConcluded={isConcluded} />
      </div>
    </main>
  );
}
