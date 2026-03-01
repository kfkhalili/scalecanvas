import { describe, it, expect } from "vitest";
import { readConclusionStream } from "./conclusionStream";

const enc = new TextEncoder();

function makeStream(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(enc.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("readConclusionStream", () => {
  it("returns empty string for empty stream", async () => {
    const result = await readConclusionStream(makeStream());
    expect(result).toBe("");
  });

  it("decodes a JSON-encoded string chunk", async () => {
    const result = await readConclusionStream(makeStream('0:"hello"\n'));
    expect(result).toBe("hello");
  });

  it("falls back to raw text when chunk is not valid JSON", async () => {
    const result = await readConclusionStream(makeStream("0:hello\n"));
    expect(result).toBe("hello");
  });

  it("concatenates multiple chunks in order", async () => {
    const result = await readConclusionStream(makeStream('0:"foo"\n', '0:"bar"\n', '0:"baz"\n'));
    expect(result).toBe("foobarbaz");
  });

  it("ignores non-0 protocol lines", async () => {
    const result = await readConclusionStream(
      makeStream('8:[{"type":"metadata"}]\n', '0:"text"\n', "e:done\n")
    );
    expect(result).toBe("text");
  });

  it("processes leftover buffer without trailing newline", async () => {
    const result = await readConclusionStream(makeStream('0:"done"'));
    expect(result).toBe("done");
  });

  it("stringifies non-string JSON values", async () => {
    const result = await readConclusionStream(makeStream("0:42\n"));
    expect(result).toBe("42");
  });

  it("reassembles a line split across two decoder reads", async () => {
    // Split the encoded bytes mid-line so neither chunk alone contains a complete line.
    const full = enc.encode('0:"split"\n');
    const half = Math.floor(full.length / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(full.slice(0, half));
        controller.enqueue(full.slice(half));
        controller.close();
      },
    });
    const result = await readConclusionStream(stream);
    expect(result).toBe("split");
  });

  it("handles multiple lines in a single read", async () => {
    const result = await readConclusionStream(makeStream('0:"a"\n0:"b"\n0:"c"\n'));
    expect(result).toBe("abc");
  });

  it("handles lines mixed across multiple reads", async () => {
    // First read ends mid-line, second read completes it and adds another.
    const result = await readConclusionStream(makeStream('0:"he', 'llo"\n0:"world"\n'));
    expect(result).toBe("helloworld");
  });
});
