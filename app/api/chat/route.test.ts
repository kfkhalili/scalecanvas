import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/chat", () => {
  it("returns 503 when Bedrock env vars are missing", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        nodes: [],
        edges: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("BEDROCK_MODEL_ID");
  });
});
