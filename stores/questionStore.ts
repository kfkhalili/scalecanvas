import { create } from "zustand";
import type { SystemDesignQuestion } from "@/lib/questions";

type QuestionStore = {
  activeQuestion: SystemDesignQuestion | null;
  hintIndex: number;
  setInitialQuestion: (question: SystemDesignQuestion) => void;
  incrementHint: () => void;
};

export const useQuestionStore = create<QuestionStore>((set) => ({
  activeQuestion: null,
  hintIndex: 0,
  setInitialQuestion: (question) =>
    set({ activeQuestion: question, hintIndex: 0 }),
  incrementHint: () =>
    set((state) => ({ hintIndex: state.hintIndex + 1 })),
}));
