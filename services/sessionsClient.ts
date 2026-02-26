import { Effect, Option, pipe } from "effect";
import type {
  Session,
  TranscriptEntry,
  CanvasState,
  SessionSettings,
} from "@/lib/types";
import type {
  CreateSessionBody,
  AppendTranscriptBody,
} from "@/lib/api.schemas";

/** JSON body shape when API returns an error (e.g. 4xx/5xx). */
type ApiErrorResponse = { error?: string };

export type ApiError = { message: string };

function parseErrorResponse(data: ApiErrorResponse): string {
  return data.error ?? "Unknown error";
}

function apiGet<T>(path: string): Effect.Effect<T, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () => fetch(path, { credentials: "include" }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<T>,
            catch: (e) => ({
              message: e instanceof Error ? e.message : "Parse error",
            }),
          })
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({ message: parseErrorResponse(data) || res.statusText })
            )
          )
    )
  );
}

function apiPost<T>(
  path: string,
  body: CreateSessionBody | AppendTranscriptBody
): Effect.Effect<T, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<T>,
            catch: (e) => ({
              message: e instanceof Error ? e.message : "Parse error",
            }),
          })
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({ message: parseErrorResponse(data) || res.statusText })
            )
          )
    )
  );
}

function apiPut(path: string, body: CanvasState): Effect.Effect<undefined, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch(path, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.succeed(undefined)
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({ message: parseErrorResponse(data) || res.statusText })
            )
          )
    )
  );
}

function apiDelete(path: string): Effect.Effect<undefined, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () => fetch(path, { method: "DELETE", credentials: "include" }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.succeed(undefined)
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({ message: parseErrorResponse(data) || res.statusText })
            )
          )
    )
  );
}

function sessionsPath(): string {
  if (typeof window === "undefined") return "/api/sessions";
  return `${window.location.origin}/api/sessions`;
}

export function fetchSessions(): Effect.Effect<Session[], ApiError> {
  return apiGet<Session[]>(sessionsPath());
}

export function createSessionApi(
  titleOpt: Option.Option<string> = Option.none()
): Effect.Effect<Session, ApiError> {
  return apiPost<Session>(sessionsPath(), {
    title: Option.getOrNull(titleOpt),
  });
}

export function fetchSession(
  sessionId: string
): Effect.Effect<Session, ApiError> {
  return apiGet<Session>(`${sessionsPath()}/${sessionId}`);
}

export function renameSessionApi(
  sessionId: string,
  title: string
): Effect.Effect<Session, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch(`${sessionsPath()}/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
          credentials: "include",
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<Session>,
            catch: (e) => ({
              message: e instanceof Error ? e.message : "Parse error",
            }),
          })
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({
                message: parseErrorResponse(data) || res.statusText,
              })
            )
          )
    )
  );
}

export function deleteSessionApi(
  sessionId: string
): Effect.Effect<undefined, ApiError> {
  return apiDelete(`${sessionsPath()}/${sessionId}`);
}

export function fetchTranscript(
  sessionId: string
): Effect.Effect<TranscriptEntry[], ApiError> {
  return apiGet<TranscriptEntry[]>(
    `${sessionsPath()}/${sessionId}/transcript`
  );
}

export function appendTranscriptApi(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Effect.Effect<TranscriptEntry, ApiError> {
  return apiPost<TranscriptEntry>(
    `${sessionsPath()}/${sessionId}/transcript`,
    { role, content }
  );
}

export function fetchCanvas(
  sessionId: string
): Effect.Effect<CanvasState, ApiError> {
  return apiGet<CanvasState>(`${sessionsPath()}/${sessionId}/canvas`);
}

export function saveCanvasApi(
  sessionId: string,
  state: CanvasState
): Effect.Effect<undefined, ApiError> {
  return apiPut(`${sessionsPath()}/${sessionId}/canvas`, state);
}

export function fetchSessionSettings(
  sessionId: string
): Effect.Effect<SessionSettings, ApiError> {
  return apiGet<SessionSettings>(
    `${sessionsPath()}/${sessionId}/settings`
  );
}

export function saveSessionSettingsApi(
  sessionId: string,
  settings: SessionSettings
): Effect.Effect<SessionSettings, ApiError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch(`${sessionsPath()}/${sessionId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
          credentials: "include",
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<SessionSettings>,
            catch: (e) => ({
              message: e instanceof Error ? e.message : "Parse error",
            }),
          })
        : Effect.tryPromise({
            try: () =>
              res.json().catch(() => ({})) as Promise<ApiErrorResponse>,
            catch: () => ({ message: res.statusText || "Request failed" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({
                message: data.error ?? res.statusText,
              })
            )
          )
    )
  );
}
