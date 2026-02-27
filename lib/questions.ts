export type InterviewTopic = {
  readonly id: string;
  readonly title: string;
  readonly difficulty: "easy" | "medium" | "hard";
  readonly comprehensivePrompt: string;
  readonly conversationalPrompt: string;
};

/** Backward-compat shape for anonymous/trial first message and question store. */
export type SystemDesignQuestion = {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly hints: readonly string[];
};

function topic(
  id: string,
  title: string,
  difficulty: InterviewTopic["difficulty"],
  comprehensivePrompt: string,
  conversationalPrompt: string
): InterviewTopic {
  return {
    id,
    title,
    difficulty,
    comprehensivePrompt,
    conversationalPrompt,
  };
}

export const INTERVIEW_TOPICS: readonly InterviewTopic[] = [
  topic(
    "bitly",
    "Bit.ly",
    "easy",
    "Design a global URL shortener like Bit.ly. Assume: 100M Daily Active Users, 10:1 read/write ratio, 10 years data retention. Draft the high-level architecture.",
    "I'd like you to design a URL shortener like Bit.ly. Ask me any clarifying questions about scale, consistency, or requirements before you start."
  ),
  topic(
    "dropbox",
    "Dropbox",
    "easy",
    "Design a file sync and storage system like Dropbox. Assume: 50M users, 1PB total storage, sync across devices. Draft the core architecture.",
    "I'd like you to design a file sync and storage system like Dropbox. Feel free to ask about scale, conflict resolution, or storage assumptions before you begin."
  ),
  topic(
    "local-delivery",
    "Local Delivery Service",
    "easy",
    "Design a local delivery service (orders, drivers, tracking). Assume: 10K daily orders, 500 drivers, real-time tracking. Draft the system.",
    "I'd like you to design a local delivery service. Ask me clarifying questions about orders, drivers, and real-time tracking before you draw."
  ),
  topic(
    "news-aggregator",
    "News Aggregator",
    "easy",
    "Design a news aggregator that fetches and ranks articles. Assume: 1M users, 10K sources, personalized feed. Draft the architecture.",
    "I'd like you to design a news aggregator. Ask about scale, personalization, or ranking requirements before you start."
  ),
  topic(
    "ticketmaster",
    "Ticketmaster",
    "medium",
    "Design a high-concurrency ticket booking system like Ticketmaster. Assume: millions of users for a 10K seat venue; prevent double-booking. Draft the architecture.",
    "I'd like you to design a ticket booking system like Ticketmaster. Ask me about concurrency, consistency, and scale before you begin."
  ),
  topic(
    "fb-news-feed",
    "FB News Feed",
    "medium",
    "Design Facebook's News Feed. Assume: 1B+ users, billions of posts, real-time ranking and delivery. Draft the high-level design.",
    "I'd like you to design a news feed like Facebook's. Ask about scale, ranking, or real-time delivery before you start."
  ),
  topic(
    "tinder",
    "Tinder",
    "medium",
    "Design a dating app like Tinder (matching, swipes, real-time). Assume: 50M DAU, low-latency matching. Draft the architecture.",
    "I'd like you to design a dating app like Tinder. Ask about matching logic, scale, or real-time requirements before you draw."
  ),
  topic(
    "leetcode",
    "LeetCode",
    "medium",
    "Design a coding interview platform like LeetCode (problems, runs, judge). Assume: 1M users, 10K problems, code execution at scale. Draft the system.",
    "I'd like you to design a coding interview platform like LeetCode. Ask about code execution, sandboxing, or scale before you begin."
  ),
  topic(
    "whatsapp",
    "WhatsApp",
    "medium",
    "Design a messaging system like WhatsApp. Assume: 2B users, E2E encryption, multi-device sync. Draft the architecture.",
    "I'd like you to design a messaging system like WhatsApp. Ask about scale, encryption, or multi-device sync before you start."
  ),
  topic(
    "yelp",
    "Yelp",
    "medium",
    "Design a local business review platform like Yelp. Assume: 100M users, 200M reviews, search and recommendations. Draft the system.",
    "I'd like you to design a review platform like Yelp. Ask about search, recommendations, or scale before you draw."
  ),
  topic(
    "strava",
    "Strava",
    "medium",
    "Design a fitness tracking app like Strava (activities, GPS, social). Assume: 100M users, real-time tracking and feeds. Draft the architecture.",
    "I'd like you to design a fitness tracking app like Strava. Ask about real-time tracking, social features, or scale before you begin."
  ),
  topic(
    "rate-limiter",
    "Rate Limiter",
    "medium",
    "Design a distributed rate limiter for a public API. Assume: 10M requests/sec globally, rules per user/IP. Draft the component architecture.",
    "I'd like you to design a distributed rate limiter. Ask about scale, consistency, or algorithm choices before you start."
  ),
  topic(
    "online-auction",
    "Online Auction",
    "medium",
    "Design an online auction system (bids, countdown, winner). Assume: high concurrency, last-second bids. Draft the architecture.",
    "I'd like you to design an online auction system. Ask about concurrency, fairness, or consistency before you draw."
  ),
  topic(
    "fb-live-comments",
    "FB Live Comments",
    "medium",
    "Design live comments for a video stream like Facebook Live. Assume: millions of viewers, real-time delivery. Draft the system.",
    "I'd like you to design live comments for a video stream. Ask about scale, ordering, or delivery guarantees before you begin."
  ),
  topic(
    "fb-post-search",
    "FB Post Search",
    "medium",
    "Design search over social posts (e.g. Facebook post search). Assume: trillions of posts, full-text and filters. Draft the architecture.",
    "I'd like you to design search over social posts. Ask about scale, indexing, or query patterns before you start."
  ),
  topic(
    "price-tracking",
    "Price Tracking Service",
    "medium",
    "Design a price tracking service that monitors e-commerce and alerts users. Assume: 10M products, 1M users, near-real-time updates. Draft the system.",
    "I'd like you to design a price tracking service. Ask about crawl rate, storage, or alert delivery before you draw."
  ),
  topic(
    "instagram",
    "Instagram",
    "hard",
    "Design Instagram (feed, stories, DMs, media). Assume: 1B+ users, billions of photos/videos, real-time feed. Draft the architecture.",
    "I'd like you to design Instagram. Ask about feed ranking, stories, DMs, or media storage before you begin."
  ),
  topic(
    "youtube-top-k",
    "YouTube Top K",
    "hard",
    "Design a system to compute top-K most viewed videos in a time window. Assume: billions of views, sliding windows. Draft the architecture.",
    "I'd like you to design a system for top-K most viewed videos in a time window. Ask about scale, windows, or consistency before you start."
  ),
  topic(
    "uber",
    "Uber",
    "hard",
    "Design Uber (matching riders to drivers, real-time location, pricing). Assume: millions of concurrent users, low-latency matching. Draft the system.",
    "I'd like you to design Uber. Ask about matching, real-time location, surge pricing, or scale before you draw."
  ),
  topic(
    "robinhood",
    "Robinhood",
    "hard",
    "Design a stock trading platform like Robinhood (orders, market data, compliance). Assume: millions of users, low-latency execution. Draft the architecture.",
    "I'd like you to design a stock trading platform like Robinhood. Ask about order execution, market data, or compliance before you begin."
  ),
  topic(
    "google-docs",
    "Google Docs",
    "hard",
    "Design a collaborative document editor like Google Docs. Assume: real-time OT/CRDT, millions of concurrent editors. Draft the system.",
    "I'd like you to design a collaborative document editor like Google Docs. Ask about conflict resolution, scale, or real-time sync before you start."
  ),
  topic(
    "distributed-cache",
    "Distributed Cache",
    "hard",
    "Design a distributed cache (e.g. Memcached/Redis at scale). Assume: 100K QPS per node, consistency and eviction. Draft the architecture.",
    "I'd like you to design a distributed cache. Ask about consistency, eviction, or scale before you draw."
  ),
  topic(
    "youtube",
    "YouTube",
    "hard",
    "Design YouTube (upload, transcode, streaming, recommendations). Assume: billions of videos, exabytes of storage. Draft the architecture.",
    "I'd like you to design YouTube. Ask about upload, streaming, transcoding, or recommendations before you begin."
  ),
  topic(
    "job-scheduler",
    "Job Scheduler",
    "hard",
    "Design a distributed job scheduler (cron-like at scale). Assume: millions of jobs, dependencies, retries. Draft the system.",
    "I'd like you to design a distributed job scheduler. Ask about scale, dependencies, or guarantees before you start."
  ),
  topic(
    "web-crawler",
    "Web Crawler",
    "hard",
    "Design a web crawler for a search engine. Assume: billions of pages, politeness, deduplication. Draft the architecture.",
    "I'd like you to design a web crawler. Ask about scale, politeness, or deduplication before you draw."
  ),
  topic(
    "ad-click-aggregator",
    "Ad Click Aggregator",
    "hard",
    "Design a system to aggregate ad clicks in real time (billions of events). Assume: low-latency reporting and exactly-once semantics. Draft the system.",
    "I'd like you to design an ad click aggregation system. Ask about scale, consistency, or exactly-once before you begin."
  ),
  topic(
    "payment-system",
    "Payment System",
    "hard",
    "Design a payment system (charges, refunds, idempotency). Assume: high throughput, strong consistency. Draft the architecture.",
    "I'd like you to design a payment system. Ask about idempotency, consistency, or scale before you start."
  ),
];

export function getTopicById(id: string): InterviewTopic | undefined {
  return INTERVIEW_TOPICS.find((t) => t.id === id);
}

export function getTopicByTitle(title: string): InterviewTopic | undefined {
  return INTERVIEW_TOPICS.find((t) => t.title === title);
}

export function getRandomTopic(): InterviewTopic {
  return INTERVIEW_TOPICS[
    Math.floor(Math.random() * INTERVIEW_TOPICS.length)
  ] as InterviewTopic;
}

/** Backward-compat: returns SystemDesignQuestion using comprehensive prompt (anonymous/trial). */
export function getRandomQuestion(): SystemDesignQuestion {
  const t = getRandomTopic();
  return {
    id: t.id,
    title: t.title,
    prompt: t.comprehensivePrompt,
    hints: [],
  };
}
