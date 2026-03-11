import { Option } from "effect";
import { create } from "zustand";
import type { Session } from "@/lib/types";

type SessionStore = {
  currentSessionId: Option.Option<string>;
  sessions: ReadonlyArray<Session>;
  setCurrentSessionId: (id: Option.Option<string>) => void;
  setSessions: (sessions: ReadonlyArray<Session>) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessionId: Option.none(),
  sessions: [],
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),
}));
