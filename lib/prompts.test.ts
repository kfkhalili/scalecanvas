import { describe, it, expect } from "vitest";
import {
  getSystemPrompt,
  getSystemPromptOpening,
  getSystemPromptDesign,
  getSystemPromptConclusion,
  getSystemPromptConclusionTimeExpired,
} from "./prompts";

describe("getSystemPrompt", () => {
  it("includes FAANG interviewer role and guidelines", () => {
    const out = getSystemPrompt("");
    expect(out).toContain("FAANG interviewer");
    expect(out).toContain("system design");
    expect(out).toContain("one question");
    expect(out).toContain("concise");
  });

  it("injects canvas context between delimiters", () => {
    const ctx = "Nodes:\n- lb (load balancer)";
    const out = getSystemPrompt(ctx);
    expect(out).toContain("Current architecture diagram");
    expect(out).toContain("---");
    expect(out).toContain(ctx);
  });

  it("mentions empty diagram when context is empty", () => {
    const out = getSystemPrompt("The diagram is empty.");
    expect(out).toContain("diagram");
    expect(out).toContain("empty");
  });
});

describe("getSystemPromptOpening", () => {
  it("invites clarifying questions and injects problem text", () => {
    const problemText = "Design a URL shortener like Bit.ly.";
    const out = getSystemPromptOpening(problemText);
    expect(out).toContain("clarifying");
    expect(out).toContain(problemText);
  });
});

describe("getSystemPromptDesign", () => {
  it("references diagram and instructs to use note nodes when evaluating", () => {
    const canvasContext = "Nodes: API, DB";
    const out = getSystemPromptDesign(canvasContext);
    expect(out).toContain("terminate");
    expect(out).toContain(canvasContext);
    expect(out.toLowerCase()).toMatch(/note/);
  });

  it("instructs to warn then terminate if user strays purposefully", () => {
    const out = getSystemPromptDesign("");
    expect(out.toLowerCase()).toMatch(/warn/);
    expect(out).toContain("terminate");
  });
});

describe("getSystemPromptConclusion", () => {
  it("asks for summary and structured feedback", () => {
    const out = getSystemPromptConclusion();
    expect(out.toLowerCase()).toContain("feedback");
    expect(out.toLowerCase()).toMatch(/summar/i);
  });
});

describe("getSystemPromptConclusionTimeExpired", () => {
  it("asks for what went well, what did not, and resources", () => {
    const out = getSystemPromptConclusionTimeExpired("");
    expect(out.toLowerCase()).toMatch(/went well|what went well|what .* well/);
    expect(out.toLowerCase()).toMatch(/improve|didn't|did not|areas to improve/);
    expect(out.toLowerCase()).toMatch(/resource|reading|read/);
  });

  it("injects canvas context when provided", () => {
    const ctx = "Nodes: API, DB";
    const out = getSystemPromptConclusionTimeExpired(ctx);
    expect(out).toContain(ctx);
  });
});
