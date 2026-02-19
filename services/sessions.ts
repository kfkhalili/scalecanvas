import { ok, err, type Result } from "neverthrow";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Session, TranscriptEntry, CanvasState } from "@/lib/types";
import { sessionToPublic } from "@/lib/session";
import { transcriptToPublic } from "@/lib/transcript";
import { canvasFromDb } from "@/lib/canvas";
import type {
  DbInterviewSession,
  DbInterviewSessionInsert,
  DbSessionTranscript,
  DbSessionTranscriptInsert,
  DbCanvasState,
} from "@/lib/database.types";

type SessionError = { message: string };

export async function createSession(
  client: ServerSupabaseClient,
  userId: string,
  title?: string | null
): Promise<Result<Session, SessionError>> {
  const insertRow: DbInterviewSessionInsert = {
    user_id: userId,
    title: title ?? null,
  };
  const { data, error } = await client
    .from("interview_sessions")
    .insert(insertRow as never) // SSR client types insert as never; payload is DbInterviewSessionInsert
    .select()
    .single();
  if (error) return err({ message: error.message });
  if (!data) return err({ message: "No data returned" });
  return ok(sessionToPublic(data as DbInterviewSession));
}

export async function listSessions(
  client: ServerSupabaseClient,
  userId: string
): Promise<Result<Session[], SessionError>> {
  const { data, error } = await client
    .from("interview_sessions")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return err({ message: error.message });
  const list = (data ?? []) as DbInterviewSession[];
  return ok(list.map(sessionToPublic));
}

export async function getSession(
  client: ServerSupabaseClient,
  sessionId: string
): Promise<Result<Session, SessionError>> {
  const { data, error } = await client
    .from("interview_sessions")
    .select()
    .eq("id", sessionId)
    .single();
  if (error) return err({ message: error.message });
  if (!data) return err({ message: "Not found" });
  return ok(sessionToPublic(data as DbInterviewSession));
}

export async function deleteSession(
  client: ServerSupabaseClient,
  sessionId: string
): Promise<Result<undefined, SessionError>> {
  const { error } = await client
    .from("interview_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return err({ message: error.message });
  return ok(undefined);
}

export async function appendTranscriptEntry(
  client: ServerSupabaseClient,
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Result<TranscriptEntry, SessionError>> {
  const insertRow: DbSessionTranscriptInsert = {
    session_id: sessionId,
    role,
    content,
  };
  const { data, error } = await client
    .from("session_transcripts")
    .insert(insertRow as never)
    .select()
    .single();
  if (error) return err({ message: error.message });
  if (!data) return err({ message: "No data returned" });
  return ok(transcriptToPublic(data as DbSessionTranscript));
}

export async function getTranscript(
  client: ServerSupabaseClient,
  sessionId: string
): Promise<Result<TranscriptEntry[], SessionError>> {
  const { data, error } = await client
    .from("session_transcripts")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return err({ message: error.message });
  const list = (data ?? []) as DbSessionTranscript[];
  return ok(list.map(transcriptToPublic));
}

export async function saveCanvasState(
  client: ServerSupabaseClient,
  sessionId: string,
  state: CanvasState
): Promise<Result<undefined, SessionError>> {
  const row: {
    session_id: string;
    nodes: DbCanvasState["nodes"];
    edges: DbCanvasState["edges"];
    viewport: DbCanvasState["viewport"];
  } = {
    session_id: sessionId,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport ?? null,
  };
  const { error } = await client
    .from("canvas_states")
    .upsert(row as never, { onConflict: "session_id" });
  if (error) return err({ message: error.message });
  return ok(undefined);
}

export async function getCanvasState(
  client: ServerSupabaseClient,
  sessionId: string
): Promise<Result<CanvasState, SessionError>> {
  const { data, error } = await client
    .from("canvas_states")
    .select()
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) return err({ message: error.message });
  if (!data) {
    return ok({ nodes: [], edges: [] });
  }
  return ok(canvasFromDb(data as DbCanvasState));
}
