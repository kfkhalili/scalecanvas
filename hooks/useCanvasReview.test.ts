import { describe, it, expect } from "vitest";
import { canEvaluateFromSnapshot } from "./useCanvasReview";

describe("canEvaluateFromSnapshot", () => {
  it("returns true when never evaluated (lastEvaluated null) and has nodes and not loading", () => {
    expect(
      canEvaluateFromSnapshot("Nodes:\n- A (a)", null, true, false, false)
    ).toBe(true);
  });

  it("returns false when not enough nodes", () => {
    expect(
      canEvaluateFromSnapshot("The diagram is empty.", null, false, false, false)
    ).toBe(false);
  });

  it("returns false when snapshot unchanged since last evaluation", () => {
    const snapshot = "Nodes:\n- A (a)";
    expect(
      canEvaluateFromSnapshot(snapshot, snapshot, true, false, false)
    ).toBe(false);
  });

  it("returns true when snapshot changed since last evaluation", () => {
    expect(
      canEvaluateFromSnapshot(
        "Nodes:\n- A (a)\n- B (b)",
        "Nodes:\n- A (a)",
        true,
        false,
        false
      )
    ).toBe(true);
  });

  it("returns false when isEvaluating or isLoading", () => {
    expect(
      canEvaluateFromSnapshot("Nodes:\n- A (a)", null, true, true, false)
    ).toBe(false);
    expect(
      canEvaluateFromSnapshot("Nodes:\n- A (a)", null, true, false, true)
    ).toBe(false);
  });
});
