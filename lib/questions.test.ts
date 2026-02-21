import { describe, it, expect } from "vitest";
import { QUESTION_BANK, getRandomQuestion } from "./questions";
import type { SystemDesignQuestion } from "./questions";

describe("QUESTION_BANK", () => {
  it("has exactly three questions", () => {
    expect(QUESTION_BANK).toHaveLength(3);
  });

  it("every entry has id, title, prompt, and hints", () => {
    for (const q of QUESTION_BANK) {
      expect(typeof q.id).toBe("string");
      expect(q.id.length).toBeGreaterThan(0);
      expect(typeof q.title).toBe("string");
      expect(q.title.length).toBeGreaterThan(0);
      expect(typeof q.prompt).toBe("string");
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(Array.isArray(q.hints)).toBe(true);
      expect(q.hints.length).toBeGreaterThan(0);
    }
  });

  it("contains url-shortener, rate-limiter, and ticketmaster by id", () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    expect(ids).toContain("url-shortener");
    expect(ids).toContain("rate-limiter");
    expect(ids).toContain("ticketmaster");
  });

  it("url-shortener has three hints", () => {
    const q = QUESTION_BANK.find((x) => x.id === "url-shortener");
    expect(q).toBeDefined();
    expect(q!.hints).toHaveLength(3);
  });
});

describe("getRandomQuestion", () => {
  it("returns a question from QUESTION_BANK", () => {
    const question = getRandomQuestion();
    expect(QUESTION_BANK).toContain(question);
  });

  it("returns value with SystemDesignQuestion shape", () => {
    const question = getRandomQuestion();
    expect(question).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      prompt: expect.any(String),
      hints: expect.any(Array),
    });
    expect(question satisfies SystemDesignQuestion).toBe(question);
  });

  it("returns each question over many samples", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(getRandomQuestion().id);
    }
    expect(seen.size).toBe(QUESTION_BANK.length);
  });
});
