import { ok, err, type Result } from "neverthrow";
import type { HandoffResponse } from "@/lib/api.schemas";

type HandoffError = { message: string };

export async function postHandoff(
  questionTitle?: string | null
): Promise<Result<HandoffResponse, HandoffError>> {
  try {
    const res = await fetch("/api/auth/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ question_title: questionTitle ?? null }),
    });
    if (res.status === 401 || res.status >= 500) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return err({ message: data.error ?? "Handoff failed" });
    }
    const json = (await res.json()) as { created: boolean; session_id?: string };
    if (res.status === 201 && json.created === true && typeof json.session_id === "string") {
      return ok({ created: true, session_id: json.session_id });
    }
    return ok({ created: false });
  } catch (e) {
    return err({ message: e instanceof Error ? e.message : "Network error" });
  }
}
