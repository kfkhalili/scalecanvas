import { describe, it, expect } from "vitest";
import {
  type WorkspacePhase,
  type PhaseName,
  ALL_PHASES,
  sessionIdOf,
  canInteract,
  canChat,
  showActivationCta,
  shouldPersist,
  persistenceMode,
  isValidTransition,
  validTargets,
} from "./workspacePhase";

// ---------------------------------------------------------------------------
// Helpers — one representative value per phase
// ---------------------------------------------------------------------------

const SID = "00000000-0000-0000-0000-000000000001";

const phases: Record<PhaseName, WorkspacePhase> = {
  boot: { phase: "boot" },
  anonymous: { phase: "anonymous" },
  bootstrapping: { phase: "bootstrapping" },
  "loading-session": { phase: "loading-session", sessionId: SID },
  active: { phase: "active", sessionId: SID },
  inactive: { phase: "inactive", sessionId: SID },
};

// ---------------------------------------------------------------------------
// sessionIdOf
// ---------------------------------------------------------------------------

describe("sessionIdOf", () => {
  it.each([
    ["boot", undefined],
    ["anonymous", undefined],
    ["bootstrapping", undefined],
    ["loading-session", SID],
    ["active", SID],
    ["inactive", SID],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(sessionIdOf(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// canInteract (canvas editable + chat input enabled)
// ---------------------------------------------------------------------------

describe("canInteract", () => {
  it.each([
    ["boot", false],
    ["anonymous", true],
    ["bootstrapping", false],
    ["loading-session", false],
    ["active", true],
    ["inactive", false],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(canInteract(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// canChat (messages reach the AI backend)
// ---------------------------------------------------------------------------

describe("canChat", () => {
  it.each([
    ["boot", false],
    ["anonymous", false],
    ["bootstrapping", false],
    ["loading-session", false],
    ["active", true],
    ["inactive", false],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(canChat(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// showActivationCta
// ---------------------------------------------------------------------------

describe("showActivationCta", () => {
  it.each([
    ["boot", false],
    ["anonymous", false],
    ["bootstrapping", false],
    ["loading-session", false],
    ["active", false],
    ["inactive", true],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(showActivationCta(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// shouldPersist
// ---------------------------------------------------------------------------

describe("shouldPersist", () => {
  it.each([
    ["boot", false],
    ["anonymous", true],
    ["bootstrapping", false],
    ["loading-session", false],
    ["active", true],
    ["inactive", false],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(shouldPersist(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// persistenceMode
// ---------------------------------------------------------------------------

describe("persistenceMode", () => {
  it.each([
    ["boot", "none"],
    ["anonymous", "local"],
    ["bootstrapping", "none"],
    ["loading-session", "none"],
    ["active", "api"],
    ["inactive", "none"],
  ] as const)("returns %s for %s phase", (phaseName, expected) => {
    expect(persistenceMode(phases[phaseName])).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

describe("isValidTransition", () => {
  const allowed: [PhaseName, PhaseName][] = [
    // boot exits
    ["boot", "anonymous"],
    ["boot", "bootstrapping"],
    ["boot", "loading-session"],
    // bootstrapping exits
    ["bootstrapping", "loading-session"],
    // loading-session exits
    ["loading-session", "active"],
    ["loading-session", "inactive"],
    // active exits
    ["active", "loading-session"],
    ["active", "inactive"],
    // inactive exits
    ["inactive", "active"],
    ["inactive", "loading-session"],
  ];

  it.each(allowed)("%s → %s is valid", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it("anonymous has no outgoing transitions", () => {
    for (const target of ALL_PHASES) {
      expect(isValidTransition("anonymous", target)).toBe(false);
    }
  });

  it("every phase is covered by ALL_PHASES", () => {
    const phaseKeys = Object.keys(phases) as PhaseName[];
    expect(new Set(phaseKeys)).toEqual(new Set(ALL_PHASES));
  });

  it("all allowed transitions are enumerated and no others are valid", () => {
    const allowedSet = new Set(allowed.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL_PHASES) {
      for (const to of ALL_PHASES) {
        const key = `${from}->${to}`;
        expect(isValidTransition(from, to)).toBe(
          allowedSet.has(key),
        );
      }
    }
  });
});

describe("validTargets", () => {
  it("returns the correct set for active", () => {
    expect(validTargets("active")).toEqual(
      new Set(["loading-session", "inactive"]),
    );
  });

  it("returns the correct set for inactive", () => {
    expect(validTargets("inactive")).toEqual(
      new Set(["active", "loading-session"]),
    );
  });

  it("returns an empty set for anonymous", () => {
    expect(validTargets("anonymous")).toEqual(new Set());
  });
});
