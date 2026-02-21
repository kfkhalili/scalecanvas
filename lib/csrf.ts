/**
 * CSRF protection via Origin header validation.
 * Mutation requests (POST, PUT, PATCH, DELETE) must include an Origin header
 * that matches the expected host.
 */
export function isValidOrigin(
  requestOrigin: string | null,
  requestHost: string | null
): boolean {
  if (!requestOrigin || !requestHost) return false;
  try {
    const originUrl = new URL(requestOrigin);
    return originUrl.host === requestHost;
  } catch {
    return false;
  }
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}
