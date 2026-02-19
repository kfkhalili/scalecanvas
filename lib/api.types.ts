/**
 * API request/response shapes. Used by route handlers and sessionsClient.
 */

/** JSON body shape when API returns an error (e.g. 4xx/5xx). */
export type ApiErrorResponse = { error?: string };

/** POST /api/sessions body */
export type CreateSessionBody = { title?: string | null };

/** POST /api/sessions/[id]/transcript body */
export type AppendTranscriptBody = {
  role: "user" | "assistant";
  content: string;
};

/** Union of all POST bodies used by session APIs */
export type SessionApiPostBody = CreateSessionBody | AppendTranscriptBody;
