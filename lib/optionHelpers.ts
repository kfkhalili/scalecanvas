import { Either, Option } from "effect";

/**
 * Imperatively run a callback when an Option is Some; do nothing on None.
 * Replaces the verbose `Option.match(opt, { onNone: () => {}, onSome: fn })` pattern.
 *
 * @example
 * ```ts
 * whenSome(sessionIdOpt, (id) => router.push(`/${id}`));
 * ```
 */
export function whenSome<T>(
  opt: Option.Option<T>,
  fn: (value: T) => void
): void {
  if (Option.isSome(opt)) {
    fn(opt.value);
  }
}

/**
 * Imperatively run a callback when an Either is Right; do nothing on Left.
 * Replaces the verbose `Either.match(either, { onLeft: () => {}, onRight: fn })` pattern.
 *
 * @example
 * ```ts
 * whenRight(either, (sessions) => setSessions(sessions));
 * ```
 */
export function whenRight<R, L>(
  either: Either.Either<R, L>,
  fn: (value: R) => void
): void {
  if (Either.isRight(either)) {
    fn(either.right);
  }
}
