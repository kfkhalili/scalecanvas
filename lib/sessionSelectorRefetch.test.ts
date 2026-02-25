import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { shouldRefetchSessionsForCurrentSession } from "./sessionSelectorRefetch";

describe("shouldRefetchSessionsForCurrentSession", () => {
  it("returns true when currentSessionId is set, not in sessions, not anonymous, and not already refetched for this id", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      Option.some("new-session-id"),
      [{ id: "other" }],
      Option.none(),
      false
    );
    expect(result).toBe(true);
  });

  it("returns false when currentSessionId is none", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      Option.none(),
      [],
      Option.none(),
      false
    );
    expect(result).toBe(false);
  });

  it("returns false when currentSessionId is already in sessions", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      Option.some("current"),
      [{ id: "current" }],
      Option.none(),
      false
    );
    expect(result).toBe(false);
  });

  it("returns false when isAnonymous is true", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      Option.some("new-id"),
      [],
      Option.none(),
      true
    );
    expect(result).toBe(false);
  });

  it("returns false when already refetched for this currentSessionId (avoids loop)", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      Option.some("new-id"),
      [],
      Option.some("new-id"),
      false
    );
    expect(result).toBe(false);
  });
});
