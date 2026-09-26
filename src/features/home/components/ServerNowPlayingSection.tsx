import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useSelector } from 'react-redux';

import { useApi } from '@/providers/registry/useApi';
import { useTheme } from '@/features/theme/useTheme';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { selectServerNowPlayingShelfEnabled } from '@/features/settings/home/state';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import MediaListRow from '@/components/MediaListRow';
import { useSourceSectionPresence } from './SourceGroup';
import { SECTION_H_PADDING as H_PADDING } from '@/features/home/constants';
import type { NowPlayingEntry } from '@/providers/contracts/ServerAdapter';
import { spacing, typography } from '@/constants/design';

const MAX_ROWS = 5;

type Props = {
  /** This shelf's key in the home layout, so the source group above it knows
   * which of its sections has just gone quiet. */
  sectionKey: string;
};

/**
 * Who *else* is on the server right now.
 *
 * The shelf only says something on a shared server. It used to include the
 * signed-in user, so a solo Navidrome showed you the track you could already
 * see playing in the bar at the bottom of the same screen, under a heading
 * announcing it as news — and it drew each listener as two lines of bare text,
 * with no cover and nothing to tap, unlike every other row in the app.
 *
 * Dropping your own listen is what makes it honest: on a server where nobody
 * else is listening there is nothing to report, so the shelf (and its source
 * heading) stays away entirely.
 */
export default function ServerNowPlayingSection({ sectionKey }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const api = useApi();
  const navigation = useNavigation<any>();
  // The shelf shows other listeners on shared Navidromes — a legitimate
  // privacy opt-out for someone who doesn't want to see (or be seen by)
  // roommates in real time.
  const shelfEnabled = useSelector(selectServerNowPlayingShelfEnabled);
  const activeServer = useSelector(selectActiveServer);
  const ownUsername = activeServer?.username?.trim().toLowerCase() ?? null;

  // Also gated on the server actually being reachable: this shelf polls every
  // 90s, so an unreachable server means a request hanging to its own timeout
  // on repeat, forever, behind a shelf that can never render.
  const serverReachable = useServerReachable();
  const enabled = Boolean(api.discovery) && shelfEnabled && serverReachable;

  const query = useQuery<NowPlayingEntry[]>({
    queryKey: [QueryKeys.ServerNowPlaying],
    queryFn: async () => (await api.discovery?.getNowPlaying()) ?? [],
    enabled,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  const others = useMemo(() => {
    const entries = query.data ?? [];
    return entries
      .filter(e => !ownUsername || e.username.trim().toLowerCase() !== ownUsername)
      .slice(0, MAX_ROWS);
  }, [query.data, ownUsername]);

  useSourceSectionPresence(sectionKey, enabled && others.length > 0);

  const openAlbum = useCallback((albumId?: string) => {
    if (!albumId) return;
    navigation.push('albumView', { id: albumId });
  }, [navigation]);

  if (!enabled || others.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('explore.sections.serverNowPlaying')}
      </Text>
      <View style={styles.list}>
        {others.map((e) => (
          <MediaListRow
            key={`${e.username}-${e.songId}`}
            cover={e.cover}
            title={e.title}
            subtitle={e.artist}
            // The listener is the point of the shelf, so their name rides the
            // subtitle line rather than replacing the track it describes.
            subtitleTrailing={
              <Text style={[styles.listener, { color: colors.subtext }]} numberOfLines={1}>
                {` · ${e.username}`}
              </Text>
            }
            onPress={e.albumId ? () => openAlbum(e.albumId) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.sectionTitle, marginBottom: spacing.md, marginLeft: H_PADDING },
  list: { paddingHorizontal: H_PADDING },
  listener: { ...typography.caption },
});
