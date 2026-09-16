import { useRef } from 'react';

/**
 * The previous array, when the new one holds the same things in the same order.
 *
 * Home's shelves derive their items from play stats, and a scrobble changes
 * those stats at the end of every song. The derivation runs again and returns
 * a new array even when nothing it lists has moved — the same ten albums, the
 * same order — and a new array re-renders every row in the shelf. Measured on
 * a track change, that was most of a single 60–140ms commit.
 *
 * `same` decides whether two entries are the one thing; identity by default.
 */
export function useStableList<T>(next: T[], same: (a: T, b: T) => boolean = Object.is): T[] {
  const previous = useRef(next);
  const prev = previous.current;
  if (prev !== next && !sameList(prev, next, same)) {
    previous.current = next;
  }
  return previous.current;
}

export function sameList<T>(a: T[], b: T[], same: (x: T, y: T) => boolean = Object.is): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!same(a[i], b[i])) return false;
  }
  return true;
}
