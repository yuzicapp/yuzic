import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { notify } from '@/components/toast';
import { AlertTriangle, CloudOff, Ellipsis, Podcast as PodcastIcon } from 'lucide-react-native';

import { useApi } from '@/providers/registry/useApi';
import type { PodcastChannel, PodcastEpisode } from '@/providers/contracts/ServerAdapter';
import { DetailHeaderBar, DetailHeaderIconButton } from '@/components/DetailHeader';
import { FormSheet, FormSheetField } from '@/components/FormSheet';
import MediaListRow from '@/components/MediaListRow';
import Touchable from '@/components/Touchable';
import { PodcastChannelOptions, PodcastListOptions } from '@/components/options/PodcastOptions';
import EmptyState from '@/components/EmptyState';
import SkeletonListRow from '@/components/SkeletonListRow';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { contentWidth, hitSlopFor, iconSize, spacing, statusColor, typography } from '@/constants/design';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { isUnavailableOnServer } from '@/features/library/useServerSurface';

/** Enough to see what is new without pushing the shows themselves off the screen. */
const LATEST_EPISODE_COUNT = 5;

export default function PodcastsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const api = useApi();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const serverReachable = useServerReachable();
  const scrollClearance = useScrollClearance();
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState<PodcastChannel | null>(null);

  const channelsQuery = useQuery<PodcastChannel[]>({
    queryKey: [QueryKeys.Podcasts],
    queryFn: async () => (await api.podcasts?.list(false)) ?? [],
    enabled: Boolean(api.podcasts) && serverReachable,
    staleTime: 1000 * 60 * 15,
    // Asking again won't give the server podcasts.
    retry: (failures, error) => !isUnavailableOnServer(error) && failures < 1,
  });

  // The requery below is scheduled, not awaited, so leaving the screen
  // mid-refresh has to cancel it — otherwise the timer fires against an
  // unmounted screen and `refreshing` stays pinned true for the full 5s.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!api.podcasts || refreshing) return;
    setRefreshing(true);
    try {
      await api.podcasts.refreshAll();
      // Refresh is async on the server; requery in a beat to catch the
      // updated channel list — most feeds finish within 5s of the request.
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts] });
        setRefreshing(false);
      }, 5_000);
    } catch {
      setRefreshing(false);
      notify.error(t('common.error.unexpected'));
    }
  }, [api.podcasts, queryClient, refreshing, t]);

  const channelCount = channelsQuery.data?.length ?? 0;

  // What arrived last across every show. The server keeps this list; without
  // it, a new episode meant opening each channel in turn to look for one.
  const newestQuery = useQuery<PodcastEpisode[]>({
    queryKey: [QueryKeys.Podcasts, 'newest'],
    queryFn: async () => (await api.podcasts?.newestEpisodes(LATEST_EPISODE_COUNT)) ?? [],
    enabled: Boolean(api.podcasts) && serverReachable && channelCount > 0,
    staleTime: 1000 * 60 * 15,
    // A shortcut above the list, not the list: a failed read leaves it out.
    retry: false,
  });
  const channelTitles = useMemo(
    () => new Map((channelsQuery.data ?? []).map(channel => [channel.id, channel.title])),
    [channelsQuery.data]
  );
  const latestEpisodes = newestQuery.data ?? [];
  const latestHeader = latestEpisodes.length > 0 ? (
    <View style={styles.latest}>
      <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{t('podcasts.latest')}</Text>
      {latestEpisodes.map(episode => (
        <MediaListRow
          key={episode.id}
          title={episode.title}
          subtitle={channelTitles.get(episode.channelId) ?? ''}
          cover={episode.cover}
          onPress={episode.channelId
            ? () => navigation.push('podcastChannel', { channelId: episode.channelId })
            : undefined}
        />
      ))}
    </View>
  ) : null;

  const handleDelete = useCallback((channel: PodcastChannel) => {
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
              await api.podcasts?.unsubscribe(channel.id);
              await queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts] });
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
        },
      ]
    );
  }, [api.podcasts, queryClient, t]);

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  const renderChannel = useCallback(
    ({ item }: { item: PodcastChannel }) => {
      // Through `MediaImage` like every other cover in the app, rather than a
      // hand-built URL into a raw image view: that is what makes it resolve
      // against the active server, fall back, and show the app's placeholder
      // instead of a blank square.
            return (
        <MediaListRow
          title={item.title}
          subtitle={item.errorMessage || item.description || ''}
          cover={item.cover}
          onPress={() => navigation.push('podcastChannel', { channelId: item.id })}
          // The message a broken feed reports reads in the same grey as a
          // show's own blurb, so the row says which one it is.
          subtitleTrailing={
            item.errorMessage
              ? <AlertTriangle size={icons.badge} color={statusColor.warningText} />
              : undefined
          }
          trailing={
            <Touchable
              testID="podcast-channel-options"
              onPress={() => setOptionsFor(item)}
              hitSlop={hitSlopFor(icons.row)}
              style={styles.rowAction}
              feedback="control"
              accessibilityRole="button"
              accessibilityLabel={t('a11y.rows.options', { title: item.title })}
            >
              <Ellipsis size={icons.row} color={colors.subtext} />
            </Touchable>
          }
        />
      );
    },
    [navigation, colors.subtext, t, icons]
  );

  return (
    <SafeAreaView
      testID="podcasts-screen"
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar
        title={t('podcasts.title')}
        subtitle={
          channelCount > 0 ? t('library.count.podcasts', { count: channelCount }) : undefined
        }
        rightAction={
          <DetailHeaderIconButton
            onPress={() => setListOptionsOpen(true)}
            accessibilityLabel={t('a11y.common.moreOptions')}
          >
            <Ellipsis size={iconSize.header} color={colors.secondary} />
          </DetailHeaderIconButton>
        }
      />

      {!serverReachable && !(channelsQuery.data ?? []).length ? (
        <EmptyState
          icon={<CloudOff size={iconSize.emptyState} color={colors.subtext} />}
          message={t('common.offline.serverOnlyFeature')}
        />
      ) : channelsQuery.isLoading ? (
        <View style={styles.listContent}>
          {[...Array(8)].map((_, i) => <SkeletonListRow key={i} />)}
        </View>
      ) : channelsQuery.isError && isUnavailableOnServer(channelsQuery.error) ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('podcasts.unavailable')}
        />
      ) : channelsQuery.isError ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('common.loadFailed')}
          action={{ label: t('common.retry'), onPress: () => channelsQuery.refetch() }}
        />
      ) : (channelsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<PodcastIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('podcasts.empty')}
          action={{ label: t('podcasts.add'), onPress: () => setAdding(true) }}
        />
      ) : (
        <FlatList
          data={channelsQuery.data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: scrollClearance }]}
          ItemSeparatorComponent={renderSeparator}
          ListHeaderComponent={latestHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.secondary}
            />
          }
          renderItem={renderChannel}
        />
      )}

      {listOptionsOpen && (
        <PodcastListOptions
          subtitle={
            channelCount > 0 ? t('library.count.podcasts', { count: channelCount }) : undefined
          }
          onClose={() => setListOptionsOpen(false)}
          onAdd={() => setAdding(true)}
          onRefresh={() => { void handleRefresh(); }}
        />
      )}

      {optionsFor && (
        <PodcastChannelOptions
          channel={optionsFor}
          onClose={() => setOptionsFor(null)}
          onUnsubscribe={() => handleDelete(optionsFor)}
        />
      )}

      {adding && (
        <SubscribeSheet
          onClose={() => setAdding(false)}
          onSubscribed={async () => {
            await queryClient.invalidateQueries({ queryKey: [QueryKeys.Podcasts] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

function SubscribeSheet({
  onClose,
  onSubscribed,
}: {
  onClose: () => void;
  onSubscribed: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [url, setUrl] = useState('');

  const canSave = /^https?:\/\//i.test(url.trim());

  const handleSave = useCallback(async () => {
    if (!api.podcasts) return false;
    try {
      await api.podcasts.subscribe(url.trim());
      await onSubscribed();
      return true;
    } catch {
      notify.error(t('podcasts.subscribeFailed'));
      return false;
    }
  }, [api.podcasts, onSubscribed, t, url]);

  return (
    <FormSheet
      title={t('podcasts.addTitle')}
      description={t('podcasts.addHelp')}
      // Said what it does. The button used to read `t('common.save',
      // 'Subscribe')`, and since `common.save` exists that fallback never
      // showed — the sheet titled "Subscribe to a podcast" ended in "Save".
      submitLabel={t('podcasts.add')}
      canSubmit={canSave}
      onSubmit={handleSave}
      onClose={onClose}
    >
      <FormSheetField
        label={t('podcasts.field.feedUrl')}
        value={url}
        onChangeText={setUrl}
        placeholder="https://feeds.example.com/podcast.xml"
        autoCapitalize="none"
        keyboardType="url"
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingVertical: spacing.md,
    // A column of rows, capped and centred like every other one. A
    // `FlatList` takes a width here, unlike a `FlashList`.
    width: '100%',
    maxWidth: contentWidth.readable,
    alignSelf: 'center',
  },
  // Inset to match `MediaListRow`'s own page padding, so the rule starts where
  // the row's content does rather than running to the screen edge.
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.page,
  },
  rowAction: { padding: spacing.xs },
  latest: { paddingBottom: spacing.md },
  sectionTitle: {
    ...typography.sectionTitle,
    paddingHorizontal: spacing.page,
    marginBottom: spacing.sm,
  },
});
