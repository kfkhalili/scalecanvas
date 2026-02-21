"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { rehydrateCanvasStore, useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { runPostAuthHandoff } from "@/hooks/usePostAuthHandoff";
import { deductTokenAndCreateSession } from "@/services/tokensClient";
import { createSessionApi } from "@/services/sessionsClient";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating the
 * canvas store: if hasAttemptedEval (post-OAuth handoff), runs token RPC and
 * sets pending handoff for ChatPanel; otherwise creates a session and redirects to /:id.
 */
export function PostAuthRoot(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClientInstance();
    (rehydrateCanvasStore() ?? Promise.resolve()).then(() => {
      const hasAttemptedEval = useCanvasStore.getState().hasAttemptedEval;
      const setHasAttemptedEval = useCanvasStore.getState().setHasAttemptedEval;
      const setPendingAuthHandoff = useAuthHandoffStore.getState().setPendingAuthHandoff;

      supabase.auth.getSession().then((res) => {
        const session = res.data.session;
        if (!session) {
          router.replace("/login");
          return;
        }
        if (hasAttemptedEval) {
          runPostAuthHandoff(
            res as { data: { session: unknown } },
            true,
            setHasAttemptedEval,
            () => deductTokenAndCreateSession(supabase),
            setPendingAuthHandoff
          );
        } else {
          createSessionApi().then((r) =>
            r.match(
              (s) => router.replace(`/${s.id}`),
              () => router.replace("/login")
            )
          );
        }
      });
    });
  }, [router]);

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous={false} />
      </div>
    </main>
  );
}
