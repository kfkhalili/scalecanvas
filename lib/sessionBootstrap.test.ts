import { Effect } from "effect";
import { describe, it, expect, vi } from "vitest";
import {
  decideBootstrapAction,
  executeBootstrapAction,
  type BootstrapContext,
  type BootstrapDeps,
} from "./sessionBootstrap";
import type { Session } from "@/lib/types";

function ctx(overrides: Partial<BootstrapContext> = {}): BootstrapContext {
  return {
    hasAnonymousChat: false,
    hasAttemptedEval: false,
    questionTitle: null,
    ...overrides,
  };
}

function mockSession(id: string): Session {
  return {
    id,
    userId: "u1",
    title: null,
    status: "active",
    isTrial: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mockDeps(overrides: Partial<BootstrapDeps> = {}): BootstrapDeps {
  return {
    fetchSessions: vi.fn().mockReturnValue(Effect.succeed([])),
    deductTokenAndCreateSession: vi.fn().mockReturnValue(Effect.succeed("deducted-1")),
    renameSession: vi.fn().mockResolvedValue(undefined),
    setPendingAuthHandoff: vi.fn(),
    setHasAttemptedEval: vi.fn(),
    redirectTo: vi.fn(),
    ...overrides,
  };
}

describe("decideBootstrapAction", () => {
  it("returns redirect_login when no session", () => {
    expect(decideBootstrapAction(false, ctx()).type).toBe("redirect_login");
  });

  it("returns resume_or_idle when no anonymous chat", () => {
    expect(decideBootstrapAction(true, ctx()).type).toBe("resume_or_idle");
  });

  it("returns deduct_and_handoff when anonymous chat (with or without eval)", () => {
    expect(
      decideBootstrapAction(
        true,
        ctx({ hasAnonymousChat: true, hasAttemptedEval: true })
      ).type
    ).toBe("deduct_and_handoff");
    expect(
      decideBootstrapAction(true, ctx({ hasAnonymousChat: true })).type
    ).toBe("deduct_and_handoff");
  });
});

describe("executeBootstrapAction", () => {
  it("redirect_login: redirects to /login", async () => {
    const deps = mockDeps();
    await executeBootstrapAction({ type: "redirect_login" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/login");
  });

  it("resume_or_idle: redirects to most recent session when sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.succeed([mockSession("s-recent")])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-recent");
  });

  it("resume_or_idle: does nothing when no sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.succeed([])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("resume_or_idle: does nothing on fetch error", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.fail({ message: "fail" })),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("deduct_and_handoff: clears eval flag, deducts, renames, and hands off", async () => {
    const deps = mockDeps();
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true, questionTitle: "Design X" });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.setHasAttemptedEval).toHaveBeenCalledWith(false);
    expect(deps.renameSession).toHaveBeenCalledWith("deducted-1", "Design X");
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("deducted-1");
  });

  it("deduct_and_handoff: skips rename when no questionTitle", async () => {
    const deps = mockDeps();
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true, questionTitle: null });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.renameSession).not.toHaveBeenCalled();
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("deducted-1");
  });

  it("deduct_and_handoff: does nothing on deduction error", async () => {
    const deps = mockDeps({
      deductTokenAndCreateSession: vi.fn().mockReturnValue(Effect.fail({ message: "no tokens" })),
    });
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.setHasAttemptedEval).toHaveBeenCalledWith(false);
    expect(deps.setPendingAuthHandoff).not.toHaveBeenCalled();
  });
});
