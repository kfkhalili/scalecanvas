/**
 * Consume AI SDK data stream (toDataStreamResponse format) and accumulate text.
 * Lines are "0:" + value where value is the text chunk (may be JSON-encoded).
 */
export async function readConclusionStream(
  stream: ReadableStream<Uint8Array>
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("0:")) {
          const raw = line.slice(2);
          try {
            const parsed = JSON.parse(raw) as unknown;
            text += typeof parsed === "string" ? parsed : String(parsed);
          } catch {
            text += raw;
          }
        }
      }
    }
    if (buffer.startsWith("0:")) {
      const raw = buffer.slice(2);
      try {
        const parsed = JSON.parse(raw) as unknown;
        text += typeof parsed === "string" ? parsed : String(parsed);
      } catch {
        text += raw;
      }
    }
    // Flush any bytes the decoder held back for multi-byte sequence completion.
    const flushed = decoder.decode();
    if (flushed.startsWith("0:")) {
      const raw = flushed.slice(2);
      try {
        const parsed = JSON.parse(raw) as unknown;
        text += typeof parsed === "string" ? parsed : String(parsed);
      } catch {
        text += raw;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}
