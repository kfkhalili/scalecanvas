import { describe, it, expect } from "vitest";
import {
  INTERVIEW_TOPICS,
  getRandomTopic,
  getRandomQuestion,
} from "./questions";
import type { SystemDesignQuestion } from "./questions";

describe("INTERVIEW_TOPICS", () => {
  const EXPECTED_IDS = [
    "bitly",
    "dropbox",
    "local-delivery",
    "news-aggregator",
    "ticketmaster",
    "fb-news-feed",
    "tinder",
    "leetcode",
    "whatsapp",
    "yelp",
    "strava",
    "rate-limiter",
    "online-auction",
    "fb-live-comments",
    "fb-post-search",
    "price-tracking",
    "instagram",
    "youtube-top-k",
    "uber",
    "robinhood",
    "google-docs",
    "distributed-cache",
    "youtube",
    "job-scheduler",
    "web-crawler",
    "ad-click-aggregator",
    "payment-system",
  ];

  it("has exactly 27 topics", () => {
    expect(INTERVIEW_TOPICS).toHaveLength(27);
  });

  it("every topic has id, title, difficulty, comprehensivePrompt, conversationalPrompt", () => {
    for (const t of INTERVIEW_TOPICS) {
      expect(typeof t.id).toBe("string");
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.title).toBe("string");
      expect(t.title.length).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(t.difficulty);
      expect(typeof t.comprehensivePrompt).toBe("string");
      expect(t.comprehensivePrompt.length).toBeGreaterThan(0);
      expect(typeof t.conversationalPrompt).toBe("string");
      expect(t.conversationalPrompt.length).toBeGreaterThan(0);
    }
  });

  it("contains all 27 expected topic ids", () => {
    const ids = INTERVIEW_TOPICS.map((t) => t.id);
    expect(ids.sort()).toEqual([...EXPECTED_IDS].sort());
  });
});

describe("getRandomTopic", () => {
  it("returns a topic with both prompts non-empty", () => {
    const topic = getRandomTopic();
    expect(topic).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      difficulty: expect.stringMatching(/^(easy|medium|hard)$/),
      comprehensivePrompt: expect.any(String),
      conversationalPrompt: expect.any(String),
    });
    expect(topic.comprehensivePrompt.length).toBeGreaterThan(0);
    expect(topic.conversationalPrompt.length).toBeGreaterThan(0);
    expect(INTERVIEW_TOPICS).toContain(topic);
  });

  it("returns each topic over many samples", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(getRandomTopic().id);
    }
    expect(seen.size).toBe(INTERVIEW_TOPICS.length);
  });
});

describe("getRandomQuestion", () => {
  it("returns value with SystemDesignQuestion shape from a topic", () => {
    const question = getRandomQuestion();
    expect(question).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      prompt: expect.any(String),
      hints: expect.any(Array),
    });
    expect(question satisfies SystemDesignQuestion).toBe(question);
    expect(INTERVIEW_TOPICS.some((t) => t.id === question.id)).toBe(true);
  });
});
