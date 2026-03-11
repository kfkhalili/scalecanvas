import { create } from "zustand";
import type { TranscriptEntry } from "@/lib/types";

type TranscriptStore = {
  entries: ReadonlyArray<TranscriptEntry>;
  /** Whether transcript data for the current session has been loaded. */
  transcriptReady: boolean;
  setEntries: (entries: ReadonlyArray<TranscriptEntry>) => void;
  setTranscriptReady: (value: boolean) => void;
  appendEntry: (entry: TranscriptEntry) => void;
};

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  entries: [],
  transcriptReady: false,
  setEntries: (entries) => set({ entries }),
  setTranscriptReady: (transcriptReady) => set({ transcriptReady }),
  appendEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry] })),
}));
