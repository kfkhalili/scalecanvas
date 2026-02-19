import { create } from "zustand";
import type { Session } from "@/lib/types";

type SessionStore = {
  currentSessionId: string | null;
  sessions: ReadonlyArray<Session>;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: (sessions: ReadonlyArray<Session>) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessionId: null,
  sessions: [],
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setSessions: (sessions) => set({ sessions }),
}));
