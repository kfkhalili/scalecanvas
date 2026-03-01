import { Effect, Option, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Session,
  TranscriptEntry,
  CanvasState,
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
} from "@/lib/database.aliases";

export type SessionError = { message: string; code?: string };

function toSessionError(e: { message?: string; code?: string }): SessionError {
  return { message: e.message ?? "Unknown error", code: e.code };
}

export function createSession(
  client: ServerSupabaseClient,
  userId: string,
  titleOpt: Option.Option<string> = Option.none()
): Effect.Effect<Session, SessionError> {
  const insertRow: DbInterviewSessionInsert = {
    user_id: userId,
    title: Option.getOrNull(titleOpt),
  };
  return pipe(
    Effect.promise(() =>
      client
        .from("interview_sessions")
        // `as never`: @supabase/ssr v0.5.2 passes wrong type args to SupabaseClient,
        // causing Relation['Insert'] to resolve to `never`. Required until SSR is fixed.
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

/** Session update fields in Option form; adapter converts to DB shape. */
export type SessionUpdateFields = {
  titleOpt?: Option.Option<string>;
  statusOpt?: Option.Option<string>;
  conclusionSummaryOpt?: Option.Option<string>;
};

/**
 * Build a plain object containing only the fields the caller explicitly
 * provided.  Keys that are `undefined` on `fields` are omitted entirely so
 * that PostgREST does not NULL out columns the caller never intended to
 * touch (e.g. a rename must not clear `status`, a terminate must not clear
 * `title`).
 */
function toSessionUpdateDbFields(fields: SessionUpdateFields): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  if (fields.titleOpt !== undefined) {
    result.title = Option.getOrNull(fields.titleOpt);
  }
  if (fields.statusOpt !== undefined) {
    result.status = Option.getOrNull(fields.statusOpt);
  }
  if (fields.conclusionSummaryOpt !== undefined) {
    result.conclusion_summary = Option.getOrNull(fields.conclusionSummaryOpt);
  }
  return result;
}

export function updateSession(
  client: ServerSupabaseClient,
  sessionId: string,
  userId: string,
  fields: SessionUpdateFields
): Effect.Effect<Session, SessionError> {
  const dbFields = toSessionUpdateDbFields(fields);
  return pipe(
    Effect.promise(() =>
      client
        .from("interview_sessions")
        // `as never`: @supabase/ssr v0.5.2 passes wrong type args to SupabaseClient.
        .update(dbFields as never)
        .eq("id", sessionId)
        .eq("user_id", userId)
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
  sessionId: string,
  userId: string
): Effect.Effect<undefined, SessionError> {
  return pipe(
    Effect.promise(() =>
      client.from("interview_sessions").delete().eq("id", sessionId).eq("user_id", userId)
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
        // `as never`: @supabase/ssr v0.5.2 passes wrong type args to SupabaseClient.
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

/** Single place we convert optional viewport to DB shape (viewport: null when absent). */
function toCanvasDbInsert(
  sessionId: string,
  state: CanvasState
): { session_id: string; nodes: DbCanvasState["nodes"]; edges: DbCanvasState["edges"]; viewport: DbCanvasState["viewport"] } {
  return {
    session_id: sessionId,
    nodes: state.nodes as unknown as DbCanvasState["nodes"],
    edges: state.edges as unknown as DbCanvasState["edges"],
    viewport: state.viewport ?? null,
  };
}

export function saveCanvasState(
  client: ServerSupabaseClient,
  sessionId: string,
  state: CanvasState
): Effect.Effect<undefined, SessionError> {
  const row = toCanvasDbInsert(sessionId, state);
  return pipe(
    Effect.promise(() =>
      // `as never`: @supabase/ssr v0.5.2 passes wrong type args to SupabaseClient.
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
          : Effect.succeed({ nodes: [], edges: [] } as CanvasState)
    )
  );
}

