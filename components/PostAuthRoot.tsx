"use client";

import { Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { loadAnonymousWorkspace } from "@/stores/anonymousWorkspaceStorage";
import { postHandoff } from "@/services/handoffClient";
import { fetchSessions } from "@/services/sessionsClient";
import {
  decideBootstrapAction,
  executeBootstrapAction,
  type BootstrapContext,
  type BootstrapDeps,
} from "@/lib/sessionBootstrap";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating
 * persisted stores it delegates to decideBootstrapAction + executeBootstrapAction:
 *
 *  - No session → redirect to login
 *  - Anonymous chat exists → POST /api/auth/handoff: if eligible, create trial
 *    session and navigate; else clear state and resume most recent
 *  - No anonymous chat → redirect to most recent session or show empty workspace
 */
export function PostAuthRoot(): React.ReactElement {
  const router = useRouter();
  const [storesReady, setStoresReady] = useState(false);
  // One-shot guard: prevents double-firing if React Strict Mode remounts this
  // effect or if storesReady toggles more than once during a rapid re-render.
  const bootstrapCalledRef = useRef(false);

  useEffect(() => {
    loadAnonymousWorkspace();
    queueMicrotask(() => setStoresReady(true));
  }, []);

  useEffect(() => {
    if (!storesReady) return;
    if (bootstrapCalledRef.current) return;
    bootstrapCalledRef.current = true;

    useWorkspaceStore.getState().enterBootstrapping();

    const supabase = createBrowserClientInstance();
    const setHasAttemptedEval = useCanvasStore.getState().setHasAttemptedEval;
    const setPendingAuthHandoff = useAuthHandoffStore.getState().setPendingAuthHandoff;
    const hasAnonymousChat = useAuthHandoffStore.getState().anonymousMessages.length > 0;
    const questionTitle = useAuthHandoffStore.getState().questionTitle;

    const debug =
      typeof window !== "undefined" &&
      (window as Window & { __E2E_DEBUG__?: boolean }).__E2E_DEBUG__;
    if (debug) {
      console.log("[PostAuthRoot] storesReady=true", {
        hasAnonymousChat,
        questionTitle: Option.getOrNull(questionTitle),
      });
    }

    supabase.auth.getUser().then((res) => {
      const user = res.data.user;
      if (debug) {
        console.log("[PostAuthRoot] getUser", user ? { id: user.id } : "no user");
      }

      const action = decideBootstrapAction(!!user, hasAnonymousChat);

      if (action.type === "handoff") {
        // Reset eval state so the new trial session starts fresh.
        setHasAttemptedEval(false);
      }

      const ctx: BootstrapContext = {
        hasAnonymousChat,
        questionTitle,
      };

      const deps: BootstrapDeps = {
        fetchSessions: () => fetchSessions(),
        redirectTo: (path) => router.replace(path),
        doHandoff: (qt) => postHandoff(qt),
        setPendingAuthHandoff: (sessionId) =>
          setPendingAuthHandoff(Option.some(sessionId)),
        clearAnonymousState: () => {
          useAuthHandoffStore.getState().setAnonymousMessages([]);
          useAuthHandoffStore.getState().setQuestionTitle(Option.none());
        },
        notifyTrialAlreadyClaimed: () => {
          toast.info(
            "Your trial session was already created. Resuming your existing session."
          );
        },
      };

      void executeBootstrapAction(action, ctx, deps);
    });
  }, [storesReady, router]);

  if (!storesReady) {
    return (
      <main className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading session…</div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous={false} />
      </div>
    </main>
  );
}
