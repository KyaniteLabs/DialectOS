/**
 * Lightweight Result type for explicit error handling.
 *
 * Using a discriminated union forces callers to check `ok` before accessing
 * `value`, eliminating the class of bugs where exceptions are silently
 * swallowed or ignored.
 *
 * @example
 * ```ts
 * function mightFail(): Result<number, string> {
 *   if (Math.random() > 0.5) return ok(42);
 *   return err("something went wrong");
 * }
 *
 * const result = mightFail();
 * if (!result.ok) {
 *   console.error(result.error);
 *   return;
 * }
 * console.log(result.value); // 42
 * ```
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Construct a successful Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Construct a failed Result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
