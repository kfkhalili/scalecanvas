import { describe, it, expect } from "vitest";
import {
  CreateSessionBodySchema,
  UpdateSessionBodySchema,
  AppendTranscriptBodySchema,
  CanvasBodySchema,
  ChatBodySchema,
  CheckoutBodySchema,
  MAX_NODES,
  MAX_EDGES,
  MAX_MESSAGES,
} from "./api.schemas";

describe("CreateSessionBodySchema", () => {
  it("accepts empty object", () => {
    expect(CreateSessionBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts title string", () => {
    expect(CreateSessionBodySchema.safeParse({ title: "My Session" }).success).toBe(true);
  });

  it("accepts null title", () => {
    expect(CreateSessionBodySchema.safeParse({ title: null }).success).toBe(true);
  });

  it("rejects numeric title", () => {
    expect(CreateSessionBodySchema.safeParse({ title: 42 }).success).toBe(false);
  });
});

describe("UpdateSessionBodySchema", () => {
  it("accepts string title", () => {
    expect(UpdateSessionBodySchema.safeParse({ title: "New Title" }).success).toBe(true);
  });

  it("accepts null title", () => {
    expect(UpdateSessionBodySchema.safeParse({ title: null }).success).toBe(true);
  });

  it("rejects missing title", () => {
    expect(UpdateSessionBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("AppendTranscriptBodySchema", () => {
  it("accepts valid user transcript", () => {
    expect(
      AppendTranscriptBodySchema.safeParse({ role: "user", content: "Hello" }).success
    ).toBe(true);
  });

  it("accepts assistant role", () => {
    expect(
      AppendTranscriptBodySchema.safeParse({ role: "assistant", content: "Hi" }).success
    ).toBe(true);
  });

  it("rejects empty content", () => {
    expect(
      AppendTranscriptBodySchema.safeParse({ role: "user", content: "" }).success
    ).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(
      AppendTranscriptBodySchema.safeParse({ role: "system", content: "X" }).success
    ).toBe(false);
  });

  it("rejects content exceeding 50K chars", () => {
    const longContent = "a".repeat(50_001);
    expect(
      AppendTranscriptBodySchema.safeParse({ role: "user", content: longContent }).success
    ).toBe(false);
  });
});

describe("CanvasBodySchema", () => {
  it("accepts valid canvas", () => {
    const result = CanvasBodySchema.safeParse({
      nodes: [{ id: "n1", position: { x: 0, y: 0 } }],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects too many nodes", () => {
    const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({
      id: `n${i}`,
      position: { x: 0, y: 0 },
    }));
    expect(CanvasBodySchema.safeParse({ nodes, edges: [] }).success).toBe(false);
  });

  it("rejects too many edges", () => {
    const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({
      id: `e${i}`,
      source: "a",
      target: "b",
    }));
    expect(CanvasBodySchema.safeParse({ nodes: [], edges }).success).toBe(false);
  });
});

describe("ChatBodySchema", () => {
  it("accepts valid chat body", () => {
    const result = ChatBodySchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
      session_id: "sess-1",
    });
    expect(result.success).toBe(true);
  });

  it("defaults nodes and edges to empty", () => {
    const result = ChatBodySchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes).toEqual([]);
      expect(result.data.edges).toEqual([]);
    }
  });

  it("rejects empty messages", () => {
    expect(ChatBodySchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it("rejects too many messages", () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, () => ({
      role: "user" as const,
      content: "X",
    }));
    expect(ChatBodySchema.safeParse({ messages }).success).toBe(false);
  });

  it("accepts array content in messages", () => {
    const result = ChatBodySchema.safeParse({
      messages: [{ role: "user", content: [{ text: "part1" }] }],
    });
    expect(result.success).toBe(true);
  });
});

describe("CheckoutBodySchema", () => {
  it("accepts valid pack_id", () => {
    expect(CheckoutBodySchema.safeParse({ pack_id: "pack_3" }).success).toBe(true);
  });

  it("rejects empty pack_id", () => {
    expect(CheckoutBodySchema.safeParse({ pack_id: "" }).success).toBe(false);
  });

  it("rejects missing pack_id", () => {
    expect(CheckoutBodySchema.safeParse({}).success).toBe(false);
  });
});
