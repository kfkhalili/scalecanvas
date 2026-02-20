import { describe, it, expect } from "vitest";
import { isSessionContentReady } from "./sessionLoading";

describe("isSessionContentReady", () => {
  it("returns true when there is no session (empty state)", () => {
    expect(isSessionContentReady(undefined, false, false)).toBe(true);
    expect(isSessionContentReady(undefined, true, false)).toBe(true);
    expect(isSessionContentReady(undefined, false, true)).toBe(true);
  });

  it("returns false when session exists but canvas or transcript not ready", () => {
    expect(isSessionContentReady("s1", false, false)).toBe(false);
    expect(isSessionContentReady("s1", true, false)).toBe(false);
    expect(isSessionContentReady("s1", false, true)).toBe(false);
  });

  it("returns true when session exists and both canvas and transcript ready", () => {
    expect(isSessionContentReady("s1", true, true)).toBe(true);
  });
});
