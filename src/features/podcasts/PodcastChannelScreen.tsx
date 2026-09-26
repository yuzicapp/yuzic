import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/toast';
import { ArrowDownCircle, CheckCircle, Ellipsis, Play, Podcast as PodcastIcon } from 'lucide-react-native';

import { useSelector } from 'react-redux';
import { useApi } from '@/providers/registry/useApi';
import type { PodcastChannel, PodcastEpisode } from '@/providers/contracts/ServerAdapter';
import { podcastEpisodeToSong } from '@/features/podcasts/buildPodcastSong';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { DetailHeaderBar, DetailHeaderIconButton } from '@/components/DetailHeader';
import { PodcastChannelOptions, PodcastEpisodeOptions } from '@/components/options/PodcastOptions';
import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import EmptyState from '@/components/EmptyState';
import SkeletonListRow from '@/components/SkeletonListRow';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useListDensity } from '@/features/theme/useListDensity';
import { hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { QueryKeys } from '@/state/query/queryKeys';
import { usePlayingActions } from '@/features/playback/PlayingContext';

const DOWNLOAD_POLL_MS = 5_000;

function formatDate(publishDate: string | undefined): string {
  if (!publishDate) return '';
  try {
    return new Date(publishDate).toLocaleDateString();
  } catch {
    return publishDate;
  }
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function PodcastChannelScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const scrollClearance = useScrollClearance();
  const density = useListDensity();
  const api = useApi();
  const queryClient = useQueryClient();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { playSong } = usePlayingActions();
  const activeServer = useSelector(selectActiveServer);
  const [channelOptionsOpen, setChannelOptionsOpen] = useState(false);
  const [episodeOptionsFor, setEpisodeOptionsFor] = useState<PodcastEpisode | null>(null);

  const channelsQuery = useQuery<PodcastChannel[]>({
    queryKey: [QueryKeys.Podcasts, 'withEpisodes'],
    queryFn: async () => (await api.podcasts?.list(true)) ?? [],
    enabled: Boolean(api.podcasts),
    staleTime: 1000 * 60 * 5,
    // Asked again while one of this channel's episodes is downloading. A
    // single re-read five seconds after the request left any episode that took
    // longer spinning until the screen was left and opened again.
    refetchInterval: query =>
      (query.state.data ?? []).some(c => c.id === channelId && c.episodes.some(e => e.status === 'downloading'))
        ? DOWNLOAD_POLL_MS
        : false,
  });

  const channel = useMemo(
    () => (channelsQuery.data ?? []).find((c) => c.id === channelId) ?? null,
    [channelsQuery.data, channelId]
  );

  const handlePlay = useCallback((episode: PodcastEpisode) => {
    // `playableStreamId` is only populated once the episode is downloaded,
    // so this path only fires for downloaded episodes.
    if (!channel || !episode.playableStreamId || !activeServer?.id) return;
    void playSong(podcastEpisodeToSong(episode, channel, activeServer.id));
  }, [activeServer?.id, channel, playSong]);

  const handleDownload = useCallback(async (episode: PodcastEpisode) => {
    if (!api.podcasts) return;
    try {
      await api.podcasts.downloadEpisode(episode.id);
      notify.info(t('podcasts.downloadStarted'));
      // Re-read now to pick up the "downloading" status; the query polls from there.
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts, 'withEpisodes'] });
    } catch {
      notify.error(t('common.error.unexpected'));
    }
  }, [api.podcasts, queryClient, t]);

  // A downloaded episode takes space on the server. The server could always
  // delete one; the app gave no way to ask, so a finished show stayed on disk.
  const handleDelete = useCallback((episode: PodcastEpisode) => {
    const podcasts = api.podcasts;
    if (!podcasts) return;
    Alert.alert(
      t('podcasts.deleteEpisodeTitle'),
      t('podcasts.deleteEpisodeBody', { title: episode.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await podcasts.deleteEpisode(episode.id);
              await queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts] });
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
        },
      ]
    );
  }, [api.podcasts, queryClient, t]);

  // The show itself could only be dropped from the list screen, so the screen
  // about one show had nothing on its bar at all.
  const handleUnsubscribe = useCallback(() => {
    const podcasts = api.podcasts;
    if (!podcasts || !channel) return;
    Alert.alert(
      t('podcasts.unsubscribeTitle'),
      t('podcasts.unsubscribeBody', { title: channel.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('podcasts.unsubscribe'),
          style: 'destructive',
          onPress: async () => {
            try {
              await podcasts.unsubscribe(channel.id);
              await queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts] });
              router.back();
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
        },
      ]
    );
  }, [api.podcasts, channel, queryClient, router, t]);

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  const renderEpisode = useCallback(
    ({ item }: { item: PodcastEpisode }) => {
      const playable = item.playableStreamId !== null;
      const isDownloading = item.status === 'downloading';
      return (
        <View style={[styles.row, { paddingVertical: density.rowPadding }]}>
          <View style={styles.rowMain}>
            <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
              {[formatDate(item.publishDate), formatDuration(item.durationSeconds)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {item.description ? (
              <Text style={[styles.description, { color: colors.subtext }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.action}>
            {isDownloading ? (
              <SpinningLoaderCircle size={icons.row} color={colors.subtext} />
            ) : playable ? (
              // Play stays on the row — it is what the row is for. Deleting
              // the server's copy moves behind the "…", where every other
              // destructive action in the app lives.
              <View style={styles.episodeActions}>
                <Touchable
                  onPress={() => handlePlay(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('podcasts.play')}
                  hitSlop={hitSlopFor(22)}
                >
                  <Play size={icons.secondary} color={colors.themeColor} fill={colors.themeColor} />
                </Touchable>
                <Touchable
                  testID="episode-options"
                  onPress={() => setEpisodeOptionsFor(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.rows.options', { title: item.title })}
                  hitSlop={hitSlopFor(22)}
                  feedback="control"
                >
                  <Ellipsis size={icons.row} color={colors.subtext} />
                </Touchable>
              </View>
            ) : item.status === 'completed' ? (
              <CheckCircle size={icons.secondary} color={colors.subtext} />
            ) : (
              <Touchable
                onPress={() => void handleDownload(item)}
                accessibilityRole="button"
                accessibilityLabel={t('podcasts.download')}
                hitSlop={hitSlopFor(22)}
              >
                <ArrowDownCircle size={icons.secondary} color={colors.secondary} />
              </Touchable>
            )}
          </View>
        </View>
      );
    },
    [colors.secondary, colors.subtext, colors.themeColor, handlePlay, handleDownload, t, density.rowPadding, icons]
  );

  return (
    <SafeAreaView
      testID="podcast-channel-screen"
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar
        title={channel?.title ?? t('podcasts.title')}
        subtitle={
          channel && channel.episodes.length > 0
            ? t('library.count.episodes', { count: channel.episodes.length })
            : undefined
        }
        rightAction={channel ? (
          <DetailHeaderIconButton
            onPress={() => setChannelOptionsOpen(true)}
            accessibilityLabel={t('a11y.common.moreOptions')}
          >
            <Ellipsis size={iconSize.header} color={colors.secondary} />
          </DetailHeaderIconButton>
        ) : undefined}
      />
      {channelsQuery.isLoading ? (
        <View style={styles.listContent}>
          {[...Array(8)].map((_, i) => <SkeletonListRow key={i} />)}
        </View>
      ) : channelsQuery.isError ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('common.loadFailed')}
          action={{ label: t('common.retry'), onPress: () => channelsQuery.refetch() }}
        />
      ) : !channel ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('podcasts.notFound')}
        />
      ) : channel.episodes.length === 0 ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('podcasts.channelEmpty')}
        />
      ) : (
        <FlatList
          data={channel.episodes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: scrollClearance }]}
          ItemSeparatorComponent={renderSeparator}
          renderItem={renderEpisode}
        />
      )}

      {channelOptionsOpen && channel && (
        <PodcastChannelOptions
          channel={channel}
          onClose={() => setChannelOptionsOpen(false)}
          onUnsubscribe={handleUnsubscribe}
        />
      )}

      {episodeOptionsFor && (
        <PodcastEpisodeOptions
          episode={episodeOptionsFor}
          channelTitle={channel?.title ?? ''}
          onClose={() => setEpisodeOptionsFor(null)}
          onDelete={() => handleDelete(episodeOptionsFor)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingVertical: spacing.md, paddingHorizontal: spacing.page },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowMain: { flex: 1, minWidth: 0 },
  title: { ...typography.rowTitle },
  meta: { ...typography.caption, marginTop: spacing.xxs },
  description: { ...typography.caption, marginTop: spacing.xxs },
  action: { padding: spacing.sm },
  episodeActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
