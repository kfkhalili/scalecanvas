import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { canEvaluateFromSnapshot } from "./useCanvasReview";

describe("canEvaluateFromSnapshot", () => {
  it("returns true when never evaluated (lastEvaluated none) and has nodes and not loading", () => {
    expect(
      canEvaluateFromSnapshot(
        "Nodes:\n- A (a)",
        Option.none(),
        true,
        false,
        false
      )
    ).toBe(true);
  });

  it("returns false when not enough nodes", () => {
    expect(
      canEvaluateFromSnapshot(
        "The diagram is empty.",
        Option.none(),
        false,
        false,
        false
      )
    ).toBe(false);
  });

  it("returns false when snapshot unchanged since last evaluation", () => {
    const snapshot = "Nodes:\n- A (a)";
    expect(
      canEvaluateFromSnapshot(
        snapshot,
        Option.some(snapshot),
        true,
        false,
        false
      )
    ).toBe(false);
  });

  it("returns true when snapshot changed since last evaluation", () => {
    expect(
      canEvaluateFromSnapshot(
        "Nodes:\n- A (a)\n- B (b)",
        Option.some("Nodes:\n- A (a)"),
        true,
        false,
        false
      )
    ).toBe(true);
  });

  it("returns false when isEvaluating or isLoading", () => {
    expect(
      canEvaluateFromSnapshot(
        "Nodes:\n- A (a)",
        Option.none(),
        true,
        true,
        false
      )
    ).toBe(false);
    expect(
      canEvaluateFromSnapshot(
        "Nodes:\n- A (a)",
        Option.none(),
        true,
        false,
        true
      )
    ).toBe(false);
  });
});
