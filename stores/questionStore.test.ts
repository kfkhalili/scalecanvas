import { describe, it, expect, beforeEach } from "vitest";
import { Option } from "effect";
import { useQuestionStore } from "./questionStore";
import { INTERVIEW_TOPICS } from "@/lib/questions";
import type { SystemDesignQuestion } from "@/lib/questions";

function toQuestion(
  t: (typeof INTERVIEW_TOPICS)[number]
): SystemDesignQuestion {
  return {
    id: t.id,
    title: t.title,
    prompt: t.comprehensivePrompt,
    hints: [],
  };
}

const sampleQuestion: SystemDesignQuestion = toQuestion(INTERVIEW_TOPICS[0]!);

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
    const other = toQuestion(INTERVIEW_TOPICS[1]!);
    useQuestionStore.getState().setInitialQuestion(other);
    expect(
      Option.getOrNull(useQuestionStore.getState().activeQuestion)
    ).toBe(other);
    expect(useQuestionStore.getState().hintIndex).toBe(0);
  });
});
