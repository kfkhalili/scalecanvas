import { create } from "zustand";
import type { Session } from "@/lib/types";

type SessionStore = {
  currentSessionId: string | null;
  sessions: ReadonlyArray<Session>;
  /** When false, chat input and Evaluate are disabled (403 or terminate_interview). */
  isSessionActive: boolean;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: (sessions: ReadonlyArray<Session>) => void;
  setSessionActive: (value: boolean) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessionId: null,
  sessions: [],
  isSessionActive: true,
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setSessions: (sessions) => set({ sessions }),
  setSessionActive: (isSessionActive) => set({ isSessionActive }),
}));
