import { Option } from "effect";
import { create } from "zustand";
import type { SystemDesignQuestion } from "@/lib/questions";

type QuestionStore = {
  activeQuestion: Option.Option<SystemDesignQuestion>;
  hintIndex: number;
  setInitialQuestion: (question: SystemDesignQuestion) => void;
  incrementHint: () => void;
};

export const useQuestionStore = create<QuestionStore>((set) => ({
  activeQuestion: Option.none(),
  hintIndex: 0,
  setInitialQuestion: (question) =>
    set({ activeQuestion: Option.some(question), hintIndex: 0 }),
  incrementHint: () =>
    set((state) => ({ hintIndex: state.hintIndex + 1 })),
}));
