import { useEffect, useRef } from 'react';
import { useIsFetching } from '@tanstack/react-query';

/** How long a refresh may spin when nothing turns out to need fetching. */
export const REFRESH_SETTLE_FALLBACK_MS = 2000;

/**
 * Ends Home's pull-to-refresh once the fetches it started have finished.
 *
 * Mounted only while a refresh is in flight, and that is the point of it
 * being a component. `useIsFetching` re-renders its caller whenever any query
 * in the app starts or stops fetching, and it used to sit in `Home` itself —
 * so every fetch anywhere re-rendered the whole feed. A track change starts
 * several (the now-playing report, the server's now-playing shelf, the local
 * mix), which measured as four or five whole-Home commits of 30–50ms in the
 * second after every song ended. Here only this empty component re-renders,
 * and only during a refresh.
 */
export function RefreshSettler({ onSettled }: { onSettled: () => void }) {
  const isFetching = useIsFetching();
  const fetchStarted = useRef(false);
  const settle = useRef(onSettled);
  settle.current = onSettled;

  // If everything is still within its staleTime no fetch ever starts, and the
  // spinner would otherwise wait for a zero it is already at.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fetchStarted.current) settle.current();
    }, REFRESH_SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isFetching > 0) {
      fetchStarted.current = true;
    } else if (fetchStarted.current) {
      settle.current();
    }
  }, [isFetching]);

  return null;
}
