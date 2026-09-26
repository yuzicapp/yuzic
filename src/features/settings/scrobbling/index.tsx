import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useApi } from '@/providers/registry/useApi';
import SettingsScreen from '../components/SettingsScreen';
import SettingsCardHeader from '../components/SettingsCardHeader';
import SettingsSelectCard from '../components/SettingsSelectCard';
import { useTheme } from '@/features/theme/useTheme';
import { radius, spacing, typography } from '@/constants/design';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import {
  selectLastfmScrobbleRoute,
  selectListenBrainzScrobbleRoute,
} from '@/state/redux/selectors/scrobbleRoutingSelectors';
import { setScrobbleRoute, type ScrobbleRoute } from '@/features/settings/scrobbling/state';

/**
 * One route per destination per server: Disabled, Through the server, or
 * Direct from Yuzic. This consolidates what used to be two independent
 * on/off switches — one on the Server screen (server-side forwarding) and one
 * on the ListenBrainz screen (yuzic's own direct submission) — into a single
 * choice per destination, so a destination can't silently end up wired to
 * both at once.
 *
 * Last.fm has no Direct option this cut: a real Last.fm scrobble needs a
 * signed session (api_sig), which isn't built. Only Disabled and
 * Through-server are offered for it; the row is simply shorter rather than
 * showing a disabled third option, since there's nothing "coming later" to
 * point at yet.
 */
const ScrobblingSettings: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const api = useApi();
  const activeServer = useSelector(selectActiveServer);

  const lastfmRoute = useSelector(selectLastfmScrobbleRoute);
  const listenBrainzRoute = useSelector(selectListenBrainzScrobbleRoute);

  const setLastfmRoute = useCallback((route: ScrobbleRoute) => {
    if (!activeServer?.id) return;
    dispatch(setScrobbleRoute({ serverId: activeServer.id, destination: 'lastfm', route }));
  }, [dispatch, activeServer]);

  const setListenBrainzRoute = useCallback((route: ScrobbleRoute) => {
    if (!activeServer?.id) return;
    dispatch(setScrobbleRoute({ serverId: activeServer.id, destination: 'listenbrainz', route }));
  }, [dispatch, activeServer]);

  // Same wording the Server screen used to carry: some adapters (Subsonic)
  // "scrobble", others (Jellyfin/Emby) only "mark as played" — the label
  // reflects what the through-server route actually does on this server.
  const isScrobbleKind = api.songs.scrobbleKind === 'scrobble';
  const throughServerLabel = t(isScrobbleKind
    ? 'settings.scrobbling.throughServer'
    : 'settings.scrobbling.throughServerMarkAsPlayed');

  const lastfmItems = useMemo(() => [
    { key: 'disabled', label: t('settings.scrobbling.routeDisabled') },
    { key: 'through-server', label: throughServerLabel },
  ], [t, throughServerLabel]);

  const listenBrainzItems = useMemo(() => [
    { key: 'disabled', label: t('settings.scrobbling.routeDisabled') },
    { key: 'through-server', label: throughServerLabel },
    { key: 'direct', label: t('settings.scrobbling.routeDirect') },
  ], [t, throughServerLabel]);

  if (!activeServer) return null;

  const anyThroughServer = lastfmRoute === 'through-server' || listenBrainzRoute === 'through-server';

  return (
    <SettingsScreen title={t('settings.scrobbling.title')}>
      <SettingsCardHeader subtle title="Last.fm" />
      <SettingsSelectCard
        items={lastfmItems}
        isSelected={key => lastfmRoute === key}
        onSelect={key => setLastfmRoute(key as ScrobbleRoute)}
      />

      <SettingsCardHeader subtle title={t('settings.listenBrainz.title')} />
      <SettingsSelectCard
        items={listenBrainzItems}
        isSelected={key => listenBrainzRoute === key}
        onSelect={key => setListenBrainzRoute(key as ScrobbleRoute)}
      />

      {/*
        Yuzic has no way to confirm the media server actually forwards to the
        third-party service once "Through the server" is chosen — that
        forwarding is configured on the server itself (e.g. Navidrome's or
        Jellyfin's own Last.fm plugin). If a server administrator has also
        wired up a *direct* connection independently of this app, or if a
        listener runs another scrobbling client against the same account, the
        same play can be counted twice on the destination's side. This is
        honest risk disclosure, not a bug yuzic can fix — there is nothing
        client-side to verify against.
      */}
      {anyThroughServer && (
        <View
          testID="scrobbling-duplicate-risk-note"
          style={[styles.riskNote, { backgroundColor: colors.muted }]}
        >
          <Text style={[styles.riskText, { color: colors.warningText }]}>
            {t('settings.scrobbling.duplicateRiskNote')}
          </Text>
        </View>
      )}
    </SettingsScreen>
  );
};

export default ScrobblingSettings;

const styles = StyleSheet.create({
  riskNote: {
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  riskText: {
    ...typography.caption,
  },
});
