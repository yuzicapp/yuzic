import { useCallback, useState } from 'react'

import { useIsOffline } from '@/features/connectivity/useIsOffline'
import { useSync } from './useSync'

/**
 * Pull-to-refresh for the library: ask the server now, rather than waiting.
 *
 * The catalog is offline-first — every screen reads its list at
 * `staleTime: Infinity`, so nothing refetches on its own, and freshness comes
 * from `useSync`, which runs when the app returns to the foreground or the
 * server changes and is throttled to half an hour. That is right for battery
 * and for servers, and wrong for the person who just made a playlist on their
 * server and is looking at a list that does not have it. This is the way to
 * say "now": a forced sync bypasses the throttle and nothing else.
 *
 * Offline, the pull is a no-op rather than an error — there is nothing to ask,
 * and the list on screen is already the answer.
 */
export function useLibraryRefresh() {
  const { sync } = useSync()
  const isOffline = useIsOffline()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    if (isOffline) return
    setRefreshing(true)
    try {
      await sync(true)
    } finally {
      // The spinner belongs to this gesture, so it ends with the fetch whether
      // that fetch worked or not; a failed sync leaves the last good list up,
      // which is the same thing the screen shows offline.
      setRefreshing(false)
    }
  }, [isOffline, sync])

  return { refreshing, onRefresh }
}
