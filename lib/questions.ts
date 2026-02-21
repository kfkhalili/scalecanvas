export type SystemDesignQuestion = {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly hints: readonly string[];
};

export const QUESTION_BANK: readonly SystemDesignQuestion[] = [
  {
    id: "url-shortener",
    title: "URL Shortener",
    prompt:
      "Welcome to ScaleCanvas. Let's design a global URL shortener. To save time, assume: 100M Daily Active Users, a 10:1 read/write ratio, and 10 years of data retention. Your task: Draft the high-level architecture on the canvas.",
    hints: [
      "Hint 1: Start by placing a Load Balancer and an API Gateway to handle incoming traffic.",
      "Hint 2: What kind of database is best for a heavy-read, key-value lookup? Consider a NoSQL solution or a distributed cache like Redis.",
      "Hint 3: How will you generate unique short hashes without collisions? Consider adding a dedicated 'Ticket Server' or ID generator node.",
    ],
  },
  {
    id: "rate-limiter",
    title: "Distributed Rate Limiter",
    prompt:
      "Welcome to ScaleCanvas. Design a distributed rate limiter for a public API. Assume: 10 million requests per second globally, and rules are defined per user IP. Your task: Draft the component architecture.",
    hints: [
      "Hint 1: Where should the rate limiter live? Consider placing it as middleware behind the API Gateway.",
      "Hint 2: How will you store the counters? A fast, in-memory cache like Redis is standard.",
      "Hint 3: What algorithm will you use? (e.g., Token Bucket, Sliding Window). How will you handle race conditions across distributed cache nodes?",
    ],
  },
  {
    id: "ticketmaster",
    title: "Ticket Booking System",
    prompt:
      "Welcome to ScaleCanvas. Design a high-concurrency ticket booking system like Ticketmaster. Assume: Extreme traffic spikes (millions of users for a 10k seat venue). Your task: Draft the architecture to prevent double-booking.",
    hints: [
      "Hint 1: How do you handle the massive read traffic before tickets go on sale? Consider a CDN and heavy caching.",
      "Hint 2: To prevent double-booking, how will you lock seats? Think about a distributed locking mechanism or a transactional database.",
      "Hint 3: What happens when a user holds a seat but abandons the checkout? You will need a queue-based asynchronous worker to release expired locks.",
    ],
  },
] as const;

export const getRandomQuestion = (): SystemDesignQuestion => {
  return QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
};
