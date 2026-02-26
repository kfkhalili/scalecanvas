import { describe, it, expect } from "vitest";
import { shouldFetchPreferencesWhenNoProviders } from "./nodeLibraryPreferencesLoad";

describe("shouldFetchPreferencesWhenNoProviders", () => {
  it("returns false when URL has providers (no need to load from API)", () => {
    expect(
      shouldFetchPreferencesWhenNoProviders(true, false, false)
    ).toBe(false);
  });

  it("returns false when user is anonymous (use localStorage only)", () => {
    expect(
      shouldFetchPreferencesWhenNoProviders(false, true, false)
    ).toBe(false);
  });

  it("returns false when we have already fetched for this no-providers state (prevents infinite loop)", () => {
    expect(
      shouldFetchPreferencesWhenNoProviders(false, false, true)
    ).toBe(false);
  });

  it("returns true only when no providers in URL, not anonymous, and not yet fetched", () => {
    expect(
      shouldFetchPreferencesWhenNoProviders(false, false, false)
    ).toBe(true);
  });

  it("returns false when any of the guard conditions hold", () => {
    expect(
      shouldFetchPreferencesWhenNoProviders(true, false, true)
    ).toBe(false);
    expect(
      shouldFetchPreferencesWhenNoProviders(false, true, true)
    ).toBe(false);
    expect(
      shouldFetchPreferencesWhenNoProviders(true, true, false)
    ).toBe(false);
  });
});
