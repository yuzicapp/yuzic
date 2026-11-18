import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { hydrateAll } from '@/state/credentialCache';
import type { RootState } from '@/state/redux/store';
import { setCredentialsHydrated } from '@/state/redux/slices/serversSlice';
import { selectCredentialsHydrated } from '@/state/redux/selectors/serversSelectors';
import { serverCredentialScopes } from '@/providers/registry/serverCredentials';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Nothing that can talk to a server renders before its secrets are loaded.
 *
 * Secrets live in the platform keystore and are read once at launch into
 * `credentialCache` — every scope each server owns (`serverCredentialScopes`).
 * The app used to render while that read was in flight, so everything that
 * mounted first asked its server with an empty password. The
 * server refused; a Subsonic refusal arrived as 200 OK, and with the catalog
 * under `staleTime: Infinity` a cold start could leave Albums, Tracks and
 * Artists empty for good. Sixty-odd components reach a server through
 * `useApi`, so no per-query guard could close that window — this does, once.
 *
 * The read is local and quick, and the splash screen stays up for it. It
 * ends in `finally`, so a keystore failure still opens the app — as signed
 * out, which is what a server with no readable secrets is.
 *
 * Runs after `PersistGate`, which is what makes the server list it reads
 * reliable at this point.
 */
export function CredentialsGate({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const credentialsHydrated = useSelector(selectCredentialsHydrated);

  useEffect(() => {
    const scopes = store.getState().servers.servers.flatMap(server => serverCredentialScopes(server.id));
    hydrateAll(scopes)
      // A keystore that cannot be read opens the app signed out rather than not
      // at all. `finally` alone would pass the rejection on, unhandled.
      .catch(error => log.server.error('keystore read failed', { detail: detailOf(error) }))
      .finally(() => dispatch(setCredentialsHydrated(true)));
  }, [dispatch, store]);

  useEffect(() => {
    if (credentialsHydrated) SplashScreen.hideAsync();
  }, [credentialsHydrated]);

  return credentialsHydrated ? <>{children}</> : null;
}
