import { Option } from "effect";
import { create } from "zustand";
import type { Session } from "@/lib/types";

type SessionStore = {
  currentSessionId: Option.Option<string>;
  sessions: ReadonlyArray<Session>;
  /** When false, chat input and Evaluate are disabled (403 or terminate_interview). */
  isSessionActive: boolean;
  setCurrentSessionId: (id: Option.Option<string>) => void;
  setSessions: (sessions: ReadonlyArray<Session>) => void;
  setSessionActive: (value: boolean) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessionId: Option.none(),
  sessions: [],
  isSessionActive: true,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),
  setSessionActive: (isSessionActive) => set({ isSessionActive }),
}));
