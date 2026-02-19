import { ok, err, type Result } from "neverthrow";
import type { Session, TranscriptEntry, CanvasState } from "@/lib/types";
import type { ApiErrorResponse, SessionApiPostBody } from "@/lib/api.types";

type ApiError = { message: string };

function parseErrorResponse(data: ApiErrorResponse): string {
  return data.error ?? "Unknown error";
}

async function apiGet<T>(path: string): Promise<Result<T, ApiError>> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    return err({ message: parseErrorResponse(data) || res.statusText });
  }
  const data = (await res.json()) as T;
  return ok(data);
}

async function apiPost<T>(
  path: string,
  body: SessionApiPostBody
): Promise<Result<T, ApiError>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    return err({ message: parseErrorResponse(data) || res.statusText });
  }
  const data = (await res.json()) as T;
  return ok(data);
}

async function apiPut(
  path: string,
  body: CanvasState
): Promise<Result<undefined, ApiError>> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    return err({ message: parseErrorResponse(data) || res.statusText });
  }
  return ok(undefined);
}

async function apiDelete(path: string): Promise<Result<undefined, ApiError>> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    return err({ message: parseErrorResponse(data) || res.statusText });
  }
  return ok(undefined);
}

function sessionsPath(): string {
  if (typeof window === "undefined") return "/api/sessions";
  return `${window.location.origin}/api/sessions`;
}

export async function fetchSessions(): Promise<Result<Session[], ApiError>> {
  return apiGet<Session[]>(sessionsPath());
}

export async function createSessionApi(
  title?: string | null
): Promise<Result<Session, ApiError>> {
  return apiPost<Session>(sessionsPath(), { title: title ?? null });
}

export async function fetchSession(
  sessionId: string
): Promise<Result<Session, ApiError>> {
  return apiGet<Session>(`${sessionsPath()}/${sessionId}`);
}

export async function deleteSessionApi(
  sessionId: string
): Promise<Result<undefined, ApiError>> {
  return apiDelete(`${sessionsPath()}/${sessionId}`);
}

export async function fetchTranscript(
  sessionId: string
): Promise<Result<TranscriptEntry[], ApiError>> {
  return apiGet<TranscriptEntry[]>(
    `${sessionsPath()}/${sessionId}/transcript`
  );
}

export async function appendTranscriptApi(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Result<TranscriptEntry, ApiError>> {
  return apiPost<TranscriptEntry>(
    `${sessionsPath()}/${sessionId}/transcript`,
    { role, content }
  );
}

export async function fetchCanvas(
  sessionId: string
): Promise<Result<CanvasState, ApiError>> {
  return apiGet<CanvasState>(`${sessionsPath()}/${sessionId}/canvas`);
}

export async function saveCanvasApi(
  sessionId: string,
  state: CanvasState
): Promise<Result<undefined, ApiError>> {
  return apiPut(`${sessionsPath()}/${sessionId}/canvas`, state);
}
