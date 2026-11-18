/**
 * What to put in a record's `detail` when all you have is a `catch`.
 *
 * A caught value is `unknown`, and the 56 console sites this replaces all
 * handed the whole thing to `console.error`, which stringifies anything. A
 * record holds primitives, so the useful part has to be picked out — and the
 * useful part is almost always the message.
 *
 * Deliberately not the stack. A JS stack through an async adapter call is
 * frames of `fetch` and promise plumbing, which is long, near-identical
 * between unrelated failures, and would dominate every record's size for no
 * diagnostic gain. The component stack an `ErrorBoundary` provides is the
 * opposite case, and that one is kept.
 */
export function detailOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  // A non-Error throw: a rejected fetch body, a thrown object. `String()`
  // rather than JSON, because a circular object makes JSON throw — inside a
  // failure path, which is the worst place to add a second failure.
  try {
    return String(error);
  } catch {
    return 'unknown error';
  }
}
