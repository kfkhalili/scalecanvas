import { describe, it, expect, beforeEach } from "vitest";
import { Option } from "effect";
import { useQuestionStore } from "./questionStore";
import { QUESTION_BANK } from "@/lib/questions";
import type { SystemDesignQuestion } from "@/lib/questions";

const sampleQuestion: SystemDesignQuestion = QUESTION_BANK[0];

beforeEach(() => {
  useQuestionStore.setState({ activeQuestion: Option.none(), hintIndex: 0 });
});

describe("questionStore", () => {
  it("starts with no active question and hintIndex 0", () => {
    const state = useQuestionStore.getState();
    expect(Option.isNone(state.activeQuestion)).toBe(true);
    expect(state.hintIndex).toBe(0);
  });

  it("setInitialQuestion sets activeQuestion and resets hintIndex to 0", () => {
    useQuestionStore.getState().setInitialQuestion(sampleQuestion);
    expect(
      Option.getOrNull(useQuestionStore.getState().activeQuestion)
    ).toBe(sampleQuestion);
    expect(useQuestionStore.getState().hintIndex).toBe(0);
  });

  it("incrementHint increases hintIndex by one", () => {
    useQuestionStore.getState().setInitialQuestion(sampleQuestion);
    expect(useQuestionStore.getState().hintIndex).toBe(0);
    useQuestionStore.getState().incrementHint();
    expect(useQuestionStore.getState().hintIndex).toBe(1);
    useQuestionStore.getState().incrementHint();
    expect(useQuestionStore.getState().hintIndex).toBe(2);
  });

  it("setInitialQuestion resets hintIndex when question was already set", () => {
    useQuestionStore.getState().setInitialQuestion(sampleQuestion);
    useQuestionStore.getState().incrementHint();
    useQuestionStore.getState().incrementHint();
    const other = QUESTION_BANK[1];
    useQuestionStore.getState().setInitialQuestion(other);
    expect(
      Option.getOrNull(useQuestionStore.getState().activeQuestion)
    ).toBe(other);
    expect(useQuestionStore.getState().hintIndex).toBe(0);
  });
});
