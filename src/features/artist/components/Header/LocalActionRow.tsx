import React, { useCallback, useMemo, useState } from 'react';
import { useIconSize } from '@/features/theme/useIconSize';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Play, Shuffle } from 'lucide-react-native';
import { useSelector } from 'react-redux';

import { DetailActionRow, DetailCircleAction, DetailPlayAction } from '@/components/DetailHeader';
import DownloadStateIcon from '@/components/DownloadStateIcon';
import { fetchAlbumSongsSettled } from '@/components/options/useLazyCollectionDetails';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { notify } from '@/components/toast';
import { iconSize, shade, spacing, veil } from '@/constants/design';
import type { Artist } from '@/domain/entities/Artist';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { useArtistAlbums } from '@/features/artist/useArtistAlbums';
import { useCollectionDownloadProgress } from '@/features/downloads/useCollectionDownloadProgress';
import { useDownload } from '@/features/offline/DownloadContext';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useTracks } from '@/features/song/useTracks';
import { useTheme } from '@/features/theme/useTheme';
import { useApi } from '@/providers/registry/useApi';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';

/** Shuffle, play and download-all for an artist in the library. */
export default function LocalActionRow({ artist }: { artist: Artist }) {
  const { t } = useTranslation();
  const icons = useIconSize();
  const { isDarkMode, colors } = useTheme();
  const queryClient = useQueryClient();
  const api = useApi();
  const activeServer = useSelector(selectActiveServer);

  const { playSongInCollection } = usePlayingActions();
  const { downloadAlbumById, getCollectionDownloadState } = useDownload();
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [songsLoading, setSongsLoading] = useState(false);

  const artistAlbums = useArtistAlbums(artist.nativeId);
  const { tracks: allTracks } = useTracks();
  const artistTrackIds = useMemo(
    () => allTracks.filter(track => track.artist.localId === artist.localId).map(track => track.localId),
    [allTracks, artist.localId]
  );

  const fetchArtistSongs = useCallback(async (): Promise<Song[]> => {
    if (!activeServer?.id || !artistAlbums.length) return [];
    return fetchAlbumSongsSettled({
      queryClient,
      serverId: activeServer.id,
      albums: artistAlbums,
      getAlbum: api.albums.get,
    });
  }, [queryClient, activeServer, artistAlbums, api.albums.get]);

  const playArtist = useCallback(async (shuffle = false) => {
    if (songsLoading) return;
    const songs = await (async () => {
      setSongsLoading(true);
      try {
        return await fetchArtistSongs();
      } catch {
        return [];
      } finally {
        setSongsLoading(false);
      }
    })();

    if (!songs.length) {
      notify.error(t('common.oneSecond'));
      return;
    }

    // There is no real playlist behind "play this artist's known songs" —
    // see the equivalent comment in `components/options/ArtistOptions`.
    const playlist: Playlist = {
      localId: makeLocalId('playlist', artist.provenance, `artist:${artist.nativeId}`),
      nativeId: artist.nativeId,
      provenance: artist.provenance,
      externalIds: {},
      title: artist.name,
      cover: artist.cover,
      isOwned: false,
      songIds: songs.map(song => song.localId),
    };

    playSongInCollection(songs[0], { playlist, songs }, shuffle);
  }, [songsLoading, fetchArtistSongs, playSongInCollection, artist, t]);

  const {
    isDownloaded: isArtistFullyDownloaded,
    isDownloading: isArtistDownloading,
  } = getCollectionDownloadState(artistTrackIds);
  const downloadFraction = useCollectionDownloadProgress(artistTrackIds);

  const handleDownloadAll = useCallback(async () => {
    if (isDownloadingAll || isArtistDownloading || isArtistFullyDownloaded || !artistAlbums.length) return;
    setIsDownloadingAll(true);
    try {
      await Promise.all(artistAlbums.map(album => downloadAlbumById(album.nativeId)));
    } finally {
      setIsDownloadingAll(false);
    }
  }, [isDownloadingAll, isArtistDownloading, isArtistFullyDownloaded, artistAlbums, downloadAlbumById]);

  return (
    <DetailActionRow style={styles.buttonRow}>
      <DetailCircleAction
        onPress={() => void playArtist(true)}
        disabled={songsLoading}
        style={isDarkMode ? styles.secondaryButtonDark : styles.secondaryButton}
        accessibilityLabel={t('a11y.detail.shuffle')}
      >
        {songsLoading ? (
          <SpinningLoaderCircle size={icons.row} color={colors.secondary} />
        ) : (
          <Shuffle size={icons.row} color={colors.secondary} />
        )}
      </DetailCircleAction>

      <DetailPlayAction
        onPress={() => void playArtist(false)}
        disabled={songsLoading}
        accessibilityLabel={t('a11y.detail.play')}
      >
        {songsLoading ? (
          <SpinningLoaderCircle size={icons.row} color={colors.onThemeColor} />
        ) : (
          <Play size={iconSize.header} color={colors.onThemeColor} fill={colors.onThemeColor} />
        )}
      </DetailPlayAction>

      <DetailCircleAction
        onPress={() => void handleDownloadAll()}
        disabled={isDownloadingAll || isArtistDownloading}
        style={isDarkMode ? styles.secondaryButtonDark : styles.secondaryButton}
        accessibilityLabel={t(
          isDownloadingAll || isArtistDownloading
            ? 'a11y.detail.downloading'
            : isArtistFullyDownloaded
              ? 'a11y.detail.downloaded'
              : 'a11y.detail.download'
        )}
      >
        <DownloadStateIcon
          isDownloaded={isArtistFullyDownloaded}
          isDownloading={isDownloadingAll || isArtistDownloading}
          // Nothing to measure while the albums are still being enqueued.
          progress={isDownloadingAll ? undefined : downloadFraction}
          color={colors.secondary}
        />
      </DetailCircleAction>
    </DetailActionRow>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    marginBottom: spacing.xl,
  },
  secondaryButton: {
    backgroundColor: shade.tint,
  },
  secondaryButtonDark: {
    backgroundColor: veil.tint,
  },
});
