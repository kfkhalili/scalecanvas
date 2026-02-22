import { describe, it, expect } from "vitest";
import { shouldRefetchSessionsForCurrentSession } from "./sessionSelectorRefetch";

describe("shouldRefetchSessionsForCurrentSession", () => {
  it("returns true when currentSessionId is set, not in sessions, not anonymous, and not already refetched for this id", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      "new-session-id",
      [{ id: "other" }],
      null,
      false
    );
    expect(result).toBe(true);
  });

  it("returns false when currentSessionId is null", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      null,
      [],
      null,
      false
    );
    expect(result).toBe(false);
  });

  it("returns false when currentSessionId is already in sessions", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      "current",
      [{ id: "current" }],
      null,
      false
    );
    expect(result).toBe(false);
  });

  it("returns false when isAnonymous is true", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      "new-id",
      [],
      null,
      true
    );
    expect(result).toBe(false);
  });

  it("returns false when already refetched for this currentSessionId (avoids loop)", () => {
    const result = shouldRefetchSessionsForCurrentSession(
      "new-id",
      [],
      "new-id",
      false
    );
    expect(result).toBe(false);
  });
});
