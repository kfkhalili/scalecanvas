import { Effect, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Session,
  TranscriptEntry,
  CanvasState,
  SessionSettings,
} from "@/lib/types";
import { sessionToPublic } from "@/lib/session";
import { transcriptToPublic } from "@/lib/transcript";
import { canvasFromDb } from "@/lib/canvas";
import type {
  DbInterviewSession,
  DbInterviewSessionInsert,
  DbSessionTranscript,
  DbSessionTranscriptInsert,
  DbCanvasState,
  DbSessionSettings,
  DbSessionSettingsInsert,
  DbSessionSettingsUpdate,
} from "@/lib/database.aliases";

export type SessionError = { message: string };

function toSessionError(e: { message: string }): SessionError {
  return { message: e.message };
}

export function createSession(
  client: ServerSupabaseClient,
  userId: string,
  title?: string | null
): Effect.Effect<Session, SessionError> {
  const insertRow: DbInterviewSessionInsert = {
    user_id: userId,
    title: title ?? null,
  };
  return pipe(
    Effect.promise(() =>
      client
        .from("interview_sessions")
        .insert(insertRow as never)
        .select()
        .single()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : data
          ? Effect.succeed(sessionToPublic(data as DbInterviewSession))
          : Effect.fail({ message: "No data returned" })
    )
  );
}

export function listSessions(
  client: ServerSupabaseClient,
  userId: string
): Effect.Effect<Session[], SessionError> {
  return pipe(
    Effect.promise(() =>
      client
        .from("interview_sessions")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : Effect.succeed(
            ((data ?? []) as DbInterviewSession[]).map(sessionToPublic)
          )
    )
  );
}

export function getSession(
  client: ServerSupabaseClient,
  sessionId: string
): Effect.Effect<Session, SessionError> {
  return pipe(
    Effect.promise(() =>
      client.from("interview_sessions").select().eq("id", sessionId).single()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : data
          ? Effect.succeed(sessionToPublic(data as DbInterviewSession))
          : Effect.fail({ message: "Not found" })
    )
  );
}

export function updateSession(
  client: ServerSupabaseClient,
  sessionId: string,
  fields: { title?: string | null; status?: string | null }
): Effect.Effect<Session, SessionError> {
  return pipe(
    Effect.promise(() =>
      client
        .from("interview_sessions")
        .update(fields as never)
        .eq("id", sessionId)
        .select()
        .single()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : data
          ? Effect.succeed(sessionToPublic(data as DbInterviewSession))
          : Effect.fail({ message: "Not found" })
    )
  );
}

export function deleteSession(
  client: ServerSupabaseClient,
  sessionId: string
): Effect.Effect<undefined, SessionError> {
  return pipe(
    Effect.promise(() =>
      client.from("interview_sessions").delete().eq("id", sessionId)
    ),
    Effect.flatMap(({ error }) =>
      error ? Effect.fail(toSessionError(error)) : Effect.succeed(undefined)
    )
  );
}

export function appendTranscriptEntry(
  client: ServerSupabaseClient,
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Effect.Effect<TranscriptEntry, SessionError> {
  const insertRow: DbSessionTranscriptInsert = {
    session_id: sessionId,
    role,
    content,
  };
  return pipe(
    Effect.promise(() =>
      client
        .from("session_transcripts")
        .insert(insertRow as never)
        .select()
        .single()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : data
          ? Effect.succeed(transcriptToPublic(data as DbSessionTranscript))
          : Effect.fail({ message: "No data returned" })
    )
  );
}

export function getTranscript(
  client: ServerSupabaseClient,
  sessionId: string
): Effect.Effect<TranscriptEntry[], SessionError> {
  return pipe(
    Effect.promise(() =>
      client
        .from("session_transcripts")
        .select()
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : Effect.succeed(
            ((data ?? []) as DbSessionTranscript[]).map(transcriptToPublic)
          )
    )
  );
}

export function saveCanvasState(
  client: ServerSupabaseClient,
  sessionId: string,
  state: CanvasState
): Effect.Effect<undefined, SessionError> {
  const row = {
    session_id: sessionId,
    nodes: state.nodes as unknown as DbCanvasState["nodes"],
    edges: state.edges as unknown as DbCanvasState["edges"],
    viewport: state.viewport ?? null,
  };
  return pipe(
    Effect.promise(() =>
      client.from("canvas_states").upsert(row as never, { onConflict: "session_id" })
    ),
    Effect.flatMap(({ error }) =>
      error ? Effect.fail(toSessionError(error)) : Effect.succeed(undefined)
    )
  );
}

export function getCanvasState(
  client: ServerSupabaseClient,
  sessionId: string
): Effect.Effect<CanvasState, SessionError> {
  return pipe(
    Effect.promise(() =>
      client.from("canvas_states").select().eq("session_id", sessionId).maybeSingle()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : data
          ? Effect.succeed(canvasFromDb(data as DbCanvasState))
          : Effect.succeed({ nodes: [], edges: [] })
    )
  );
}

function sessionSettingsFromDb(_row: DbSessionSettings): SessionSettings {
  return {};
}

const DEFAULT_SESSION_SETTINGS: SessionSettings = {};

export function getSessionSettings(
  client: ServerSupabaseClient,
  sessionId: string
): Effect.Effect<SessionSettings, SessionError> {
  return pipe(
    Effect.promise(() =>
      client
        .from("session_settings")
        .select()
        .eq("session_id", sessionId)
        .maybeSingle()
    ),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(toSessionError(error))
        : Effect.succeed(
            data ? sessionSettingsFromDb(data as DbSessionSettings) : DEFAULT_SESSION_SETTINGS
          )
    )
  );
}

export function saveSessionSettings(
  client: ServerSupabaseClient,
  sessionId: string,
  _settings: SessionSettings
): Effect.Effect<undefined, SessionError> {
  const row: DbSessionSettingsInsert & DbSessionSettingsUpdate = {
    session_id: sessionId,
    auto_review_enabled: false,
    updated_at: new Date().toISOString(),
  };
  return pipe(
    Effect.promise(() =>
      client.from("session_settings").upsert(row as never, { onConflict: "session_id" })
    ),
    Effect.flatMap(({ error }) =>
      error ? Effect.fail(toSessionError(error)) : Effect.succeed(undefined)
    )
  );
}
