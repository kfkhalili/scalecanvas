import { create } from "zustand";
import type { TranscriptEntry } from "@/lib/types";

type TranscriptStore = {
  entries: ReadonlyArray<TranscriptEntry>;
  setEntries: (entries: ReadonlyArray<TranscriptEntry>) => void;
  appendEntry: (entry: TranscriptEntry) => void;
};

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  appendEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry] })),
}));
