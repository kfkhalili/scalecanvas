import { describe, it, expect } from "vitest";
import { getSystemPrompt } from "./prompts";

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
