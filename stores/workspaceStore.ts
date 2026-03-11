import { create } from "zustand";
import type { WorkspacePhase, PhaseName } from "@/lib/workspacePhase";
import { isValidTransition } from "@/lib/workspacePhase";

function guardTransition(from: PhaseName, to: PhaseName): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid workspace transition: ${from} → ${to}`);
  }
}

type WorkspaceStore = {
  readonly phase: WorkspacePhase;

  /** Force phase back to boot. Use on component remount before initiating a fresh lifecycle. */
  reset: () => void;

  /** boot → anonymous. */
  enterAnonymous: () => void;

  /** boot → bootstrapping. */
  enterBootstrapping: () => void;

  /**
   * → loading-session. Valid from: boot, bootstrapping, active, inactive.
   */
  loadSession: (sessionId: string) => void;

  /**
   * loading-session | inactive → active.
   */
  activateSession: () => void;

  /**
   * loading-session | active → inactive.
   */
  deactivateSession: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  phase: { phase: "boot" },

  reset: (): void => {
    set({ phase: { phase: "boot" } });
  },

  enterAnonymous: (): void => {
    guardTransition(get().phase.phase, "anonymous");
    set({ phase: { phase: "anonymous" } });
  },

  enterBootstrapping: (): void => {
    guardTransition(get().phase.phase, "bootstrapping");
    set({ phase: { phase: "bootstrapping" } });
  },

  loadSession: (sessionId: string): void => {
    guardTransition(get().phase.phase, "loading-session");
    set({ phase: { phase: "loading-session", sessionId } });
  },

  activateSession: (): void => {
    const current = get().phase;
    guardTransition(current.phase, "active");
    if (current.phase === "loading-session" || current.phase === "inactive") {
      set({ phase: { phase: "active", sessionId: current.sessionId } });
    }
  },

  deactivateSession: (): void => {
    const current = get().phase;
    guardTransition(current.phase, "inactive");
    if (current.phase === "loading-session" || current.phase === "active") {
      set({ phase: { phase: "inactive", sessionId: current.sessionId } });
    }
  },
}));
