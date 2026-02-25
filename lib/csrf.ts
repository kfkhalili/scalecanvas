import { Option, pipe } from "effect";

/**
 * CSRF protection via Origin header validation.
 * Mutation requests (POST, PUT, PATCH, DELETE) must include an Origin header
 * that matches the expected host.
 */
export function isValidOrigin(
  requestOrigin: Option.Option<string>,
  requestHost: Option.Option<string>
): boolean {
  return pipe(
    Option.all([requestOrigin, requestHost]),
    Option.flatMap(([origin, host]) => {
      try {
        return new URL(origin).host === host
          ? Option.some(true)
          : Option.none();
      } catch {
        return Option.none();
      }
    }),
    Option.getOrElse(() => false)
  );
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}
