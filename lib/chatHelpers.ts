import type { TranscriptEntry } from "@/lib/types";

export const CHAT_REQUEST_TIMEOUT_MS = 60_000;

export function fetchWithTimeout(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), CHAT_REQUEST_TIMEOUT_MS);
  const originalSignal = init?.signal;
  if (originalSignal) {
    originalSignal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      ac.abort();
    });
  }
  return fetch(url, { ...init, signal: ac.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

/** Reject on 401/403 so onError can show the right toast and lock the session. */
export function fetchWithGuardrail(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetchWithTimeout(url, init).then(async (res) => {
    if (res.status === 401 || res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(
        data?.error ??
          (res.status === 403 ? "Interview time has expired." : "Unauthorized.")
      ) as Error & { statusCode: number };
      err.statusCode = res.status;
      throw err;
    }
    return res;
  });
}

export function transcriptEntryToMessage(
  entry: TranscriptEntry
): { id: string; role: "user" | "assistant" | "system"; content: string } {
  return {
    id: entry.id,
    role: entry.role,
    content: entry.content,
  };
}
