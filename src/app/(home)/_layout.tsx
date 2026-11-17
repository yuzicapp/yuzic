import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';

import { useSync } from '@/features/library/useSync';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { ServerReachabilityWatcher } from '@/features/connectivity/ServerReachabilityWatcher';
import { AutoDownloadWatcher } from '@/features/downloads/AutoDownloadWatcher';
import { DownloadersQueueProvider } from '@/features/downloaders/DownloadersQueueContext';
import { useWantArrivalWatcher } from '@/features/wants/useWantArrivalWatcher';
import { AccountSheetProvider } from '@/features/settings/AccountSheetContext';

/**
 * The outer authenticated layout: providers, watchers, and the app-wide sync
 * effects. Every browsing route the app can reach after login lives inside
 * `(tabs)`, which owns its own Tabs + per-tab Stack. Detail routes (album,
 * artist, playlist, radio, podcasts, shares, downloads, genres, library
 * collections) live in the shared `(tabs)/(home,search,library)/` group so
 * they push onto the currently-focused tab's stack — the tab bar and
 * PlayingBar stay docked below across the whole browse session.
 *
 * `settings/` deliberately does NOT live in that shared group. Settings is
 * global app configuration, not tab-scoped content, and a shared-group route
 * is compiled once per tab: opening it from Home and again from Library built
 * two independent Settings stacks, each remembering its own sub-page, so the
 * app could hold three at once and returning to a tab restored whichever
 * sub-page that tab had been left on. Here it is one screen on the root
 * stack — a single instance, pushed above the dock, returning to whichever
 * tab opened it with that tab untouched underneath.
 *
 * It is an ordinary push rather than a modal presentation. A push already
 * covers the whole screen including the dock, which is all "modal" was
 * bought for here, and it keeps the screen in the same native view
 * controller as the rest of the app. `presentation: 'modal'` and
 * `'fullScreenModal'` both hand the screen to a separately-presented
 * UIViewController on iOS, where the top safe-area inset arrives as 0 — the
 * header then drew its back arrow level with the status bar clock. Nothing
 * in Settings asks for modal semantics, so the presentation that keeps the
 * insets is the right one.
 */
export default function HomeLayout() {
  const { sync } = useSync();
  const isOffline = useIsOffline();
  const isOfflineRef = useRef(isOffline);
  const appState = useRef(AppState.currentState);
  const activeServerId = useSelector(selectActiveServerId);
  const prevServerIdRef = useRef<string | null | undefined>(undefined);

  // Presence-based arrival detection for Wants (C4): watches the synced
  // library (refreshed by DownloadersQueueProvider's own poll/staggered-sync
  // loop below, which is untouched by this) and resolves any want whose
  // entity has actually shown up, by any route — never gated on jobRef.
  useWantArrivalWatcher();

  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (!isOfflineRef.current) sync();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [sync]);

  // Re-sync when switching between two real servers. The catalog itself
  // needs no explicit clear any more: every catalog query key is scoped by
  // `serverId` (`[Albums, serverId]`, ...), so the previous server's
  // persisted cache entries simply go unused rather than leaking into the
  // new server's screens — they age out under the query cache's own
  // `gcTime`/`maxAge` like anything else — genres included, now that they are
  // a query too.
  // Both values must be non-null to avoid triggering during persist rehydration
  // (null → real-id on cold start would otherwise be treated as a server switch).
  useEffect(() => {
    const prev = prevServerIdRef.current;
    prevServerIdRef.current = activeServerId;
    if (prev && activeServerId && prev !== activeServerId) {
      if (!isOfflineRef.current) sync();
    }
  }, [activeServerId, sync]);

  return (
    <AccountSheetProvider>
      <DownloadersQueueProvider>
        <ServerReachabilityWatcher />
        <AutoDownloadWatcher />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="settings" />
        </Stack>
      </DownloadersQueueProvider>
    </AccountSheetProvider>
  );
}
