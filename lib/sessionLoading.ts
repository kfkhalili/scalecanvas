/**
 * Pure helper: should we show session content (canvas + chat) or the loading placeholders?
 * Session content is shown when there is no session (empty state) or when both
 * canvas and transcript have finished loading for the current session.
 */
export function isSessionContentReady(
  sessionId: string | undefined,
  canvasReady: boolean,
  transcriptReady: boolean
): boolean {
  if (!sessionId) return true;
  return canvasReady && transcriptReady;
}
