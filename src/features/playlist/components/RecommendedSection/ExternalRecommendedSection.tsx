import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { notify } from '@/components/toast';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useRadius } from '@/features/theme/useRadius';
import IconActionButton from '@/components/IconActionButton';
import SectionHeader from '@/components/SectionHeader';
import SkeletonListRow from '@/components/SkeletonListRow';
import GetReviewSheet from '@/components/options/GetReviewSheet';
import { useSheetRef } from '@/components/useSheetRef';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import { useAnyAlbumDownloaderConnected } from '@/features/downloaders/registry';
import { selectShowSourceHeaders } from '@/features/settings/appearance/state';
import { selectSourceUse } from '@/features/settings/sources/state';
import {
  CATALOGUE_TRACKS_RECOMMENDATIONS_USE,
  fetchCatalogueAlbum,
  fetchPlaylistRecommendations,
  SCROBBLES_AVAILABLE,
  SCROBBLES_RECOMMENDATIONS_USE,
} from '@/providers/registry/pageSources';
import { ARTIST_CATALOGUE } from '@/providers/registry/artistSources';
import { QueryKeys } from '@/state/query/queryKeys';
import { onDark, spacing, typography } from '@/constants/design';
import { playlistArtistNames as computePlaylistArtistNames } from '@/features/playlist/recommendedSongs';
import type { Album } from '@/domain/entities/Album';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { ExternalRow } from './Rows';

type Props = {
  playlist: Playlist;
  songs: Song[];
  onRefreshExternal: () => void;
};

/**
 * Deezer/Last.fm discovery: Last.fm expands the playlist's own artists into
 * similar ones, Deezer turns those into playable preview tracks — see
 * `recommendedSongs.fetchExternalRecs`.
 */
export const ExternalRecommendedSection: React.FC<Props> = ({ playlist, songs, onRefreshExternal }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const showSourceHeaders = useSelector(selectShowSourceHeaders);
  const isOffline = useIsOffline();
  const catalogueEnabled = useSelector(selectSourceUse(CATALOGUE_TRACKS_RECOMMENDATIONS_USE));
  const scrobblesEnabled = useSelector(selectSourceUse(SCROBBLES_RECOMMENDATIONS_USE));
  const hasDownloader = useAnyAlbumDownloaderConnected();
  const downloadSheetRef = useSheetRef();
  const [albumForDownload, setAlbumForDownload] = useState<Album | null>(null);

  const playlistArtistNames = useMemo(() => computePlaylistArtistNames(songs), [songs]);

  const externalQueryKey = useMemo(
    () => [QueryKeys.RecommendedExternalSongs, 'playlist', playlist.nativeId, playlistArtistNames.join(',')],
    [playlist.nativeId, playlistArtistNames]
  );

  const externalQuery = useQuery({
    queryKey: externalQueryKey,
    queryFn: () => fetchPlaylistRecommendations(playlistArtistNames),
    // This row is two services in a trench coat: Last.fm expands the seed
    // artists into similar ones, Deezer turns those into playable tracks. It
    // needs both to have been turned on — plus a bundled Last.fm key to
    // expand with — so it asks for all three before calling anyone.
    enabled:
      catalogueEnabled &&
      scrobblesEnabled &&
      !isOffline &&
      playlistArtistNames.length > 0 &&
      SCROBBLES_AVAILABLE,
    staleTime: 1000 * 60 * 60 * 6,
    networkMode: 'online',
  });

  const handleDownloadExternalSong = useCallback(async (song: Song) => {
    if (!hasDownloader) return;
    if (!song.album.nativeId) {
      notify.error(t('externalAlbum.download.startFailed'));
      return;
    }

    try {
      const album = await fetchCatalogueAlbum(song.album.nativeId);
      if (!album) {
        notify.error(t('externalAlbum.download.startFailed'));
        return;
      }

      setAlbumForDownload(album);
      requestAnimationFrame(() => {
        downloadSheetRef.current?.present();
      });
    } catch {
      notify.error(t('externalAlbum.download.startFailed'));
    }
  }, [downloadSheetRef, hasDownloader, t]);

  if (!catalogueEnabled || !scrobblesEnabled || isOffline || playlistArtistNames.length === 0 || !SCROBBLES_AVAILABLE) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('playlist.recommended.catalogueTitle')}
        badge={
          showSourceHeaders ? (
            <View style={[styles.sourceBadge, { backgroundColor: ARTIST_CATALOGUE.badge.color, borderRadius: rad.pill }]}>
              <Text style={styles.sourceBadgeLetter}>{ARTIST_CATALOGUE.badge.letter}</Text>
            </View>
          ) : undefined
        }
        action={
          <IconActionButton
            icon={<RefreshCw size={icons.row} color={colors.subtext} />}
            onPress={onRefreshExternal}
            loading={externalQuery.isFetching}
            accessibilityLabel={t('playlist.recommended.refresh')}
            size="compact"
          />
        }
      />

      {externalQuery.isLoading ? (
        // Rows rather than a spinner: this is loading a list, and the
        // placeholder should keep the shape the list is about to take.
        <View style={styles.loader}>
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonListRow key={`recommended-loading-${index}`} />
          ))}
        </View>
      ) : (externalQuery.data ?? []).length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.placeholder }]}>
          {t('playlist.recommended.externalEmpty')}
        </Text>
      ) : (
        (externalQuery.data ?? []).map(song => (
          <ExternalRow
            key={song.localId}
            song={song}
            hasDownloader={hasDownloader}
            onDownload={handleDownloadExternalSong}
          />
        ))
      )}

      {albumForDownload && (
        <GetReviewSheet
          album={albumForDownload}
          sheetRef={downloadSheetRef}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingTop: spacing.xl,
  },
  sourceBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBadgeLetter: {
    ...typography.micro,
    fontWeight: '600',
    color: onDark.text,
  },
  loader: { marginVertical: spacing.xl },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.roomy,
  },
});
