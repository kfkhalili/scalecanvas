import { describe, it, expect } from "vitest";
import type { Message } from "ai";
import { extractMessageContent, toConclusionMessages } from "./useConclusionRequest";

// ---------------------------------------------------------------------------
// extractMessageContent
// ---------------------------------------------------------------------------

describe("extractMessageContent", () => {
  it("returns the string directly when content is a string", () => {
    const msg = { content: "hello" } as Message;
    expect(extractMessageContent(msg)).toBe("hello");
  });

  it("returns an empty string when content is an empty string", () => {
    const msg = { content: "" } as Message;
    expect(extractMessageContent(msg)).toBe("");
  });

  it("concatenates text parts when content is a ContentPart array", () => {
    const msg = {
      content: [{ type: "text", text: "foo" }, { type: "text", text: "bar" }],
    } as unknown as Message;
    expect(extractMessageContent(msg)).toBe("foobar");
  });

  it("skips parts without a text field in a ContentPart array", () => {
    const msg = {
      content: [{ type: "image", url: "http://example.com/img.png" }, { type: "text", text: "baz" }],
    } as unknown as Message;
    expect(extractMessageContent(msg)).toBe("baz");
  });

  it("coerces non-string text values to string", () => {
    const msg = { content: [{ type: "text", text: 42 }] } as unknown as Message;
    expect(extractMessageContent(msg)).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// toConclusionMessages
// ---------------------------------------------------------------------------

describe("toConclusionMessages", () => {
  it("maps string-content messages with correct roles", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "hi" },
      { id: "2", role: "assistant", content: "hello" },
    ];
    expect(toConclusionMessages(messages)).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("extracts text from ContentPart array content", () => {
    const messages = [
      {
        id: "1",
        role: "user",
        content: [{ type: "text", text: "part one " }, { type: "text", text: "part two" }],
      },
    ] as unknown as Message[];
    expect(toConclusionMessages(messages)).toEqual([
      { role: "user", content: "part one part two" },
    ]);
  });

  it("returns an empty array for an empty message list", () => {
    expect(toConclusionMessages([])).toEqual([]);
  });

  it("casts non-standard roles through", () => {
    const messages = [
      { id: "1", role: "system", content: "sys prompt" },
    ] as unknown as Message[];
    expect(toConclusionMessages(messages)).toEqual([
      { role: "system", content: "sys prompt" },
    ]);
  });
});
