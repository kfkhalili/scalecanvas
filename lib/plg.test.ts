import { describe, it, expect, vi, beforeEach } from "vitest";
import { PLG_TEASER_MESSAGE, performAnonymousEvalHandoff } from "./plg";
import { useCanvasStore } from "@/stores/canvasStore";

describe("PLG", () => {
  it("teaser message prompts sign-in and mentions scaling strategy", () => {
    expect(PLG_TEASER_MESSAGE).toContain("Sign in to unlock");
    expect(PLG_TEASER_MESSAGE).toContain("observations about your design");
    expect(PLG_TEASER_MESSAGE).toContain("free mock interview");
  });

  describe("performAnonymousEvalHandoff", () => {
    beforeEach(() => {
      useCanvasStore.setState({ hasAttemptedEval: false });
    });

    it("sets hasAttemptedEval to true and appends teaser as assistant message", () => {
      const setMessages = vi.fn();
      const setHasAttemptedEval = useCanvasStore.getState().setHasAttemptedEval;
      performAnonymousEvalHandoff(setHasAttemptedEval, setMessages)();

      expect(useCanvasStore.getState().hasAttemptedEval).toBe(true);
      expect(setMessages).toHaveBeenCalledTimes(1);
      const updater = setMessages.mock.calls[0][0];
      const prev: { id: string; role: string; content: string }[] = [];
      const next = updater(prev);
      expect(next).toHaveLength(1);
      expect(next[0].role).toBe("assistant");
      expect(next[0].content).toBe(PLG_TEASER_MESSAGE);
    });
  });
});
