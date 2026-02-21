import { describe, it, expect } from "vitest";
import { decideBootstrapAction, type BootstrapContext } from "./sessionBootstrap";

function ctx(overrides: Partial<BootstrapContext> = {}): BootstrapContext {
  return {
    hasAnonymousChat: false,
    hasAttemptedEval: false,
    questionTitle: null,
    ...overrides,
  };
}

describe("decideBootstrapAction", () => {
  it("returns redirect_login when no session", () => {
    expect(decideBootstrapAction(false, ctx()).type).toBe("redirect_login");
  });

  it("returns create_and_redirect when no anonymous chat", () => {
    expect(decideBootstrapAction(true, ctx()).type).toBe("create_and_redirect");
  });

  it("returns deduct_and_handoff when eval was attempted", () => {
    expect(
      decideBootstrapAction(
        true,
        ctx({ hasAnonymousChat: true, hasAttemptedEval: true })
      ).type
    ).toBe("deduct_and_handoff");
  });

  it("returns create_with_title_and_handoff when anonymous chat but no eval", () => {
    expect(
      decideBootstrapAction(
        true,
        ctx({ hasAnonymousChat: true })
      ).type
    ).toBe("create_with_title_and_handoff");
  });
});
