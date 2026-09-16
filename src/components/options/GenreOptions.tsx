import React, { forwardRef, useMemo, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { ListEnd, ListStart, Shuffle, Check, ArrowDownCircle } from 'lucide-react-native';
import { notify } from '@/components/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import type { Album } from '@/domain/entities/Album';
import type { Song } from '@/domain/entities/Song';
import type { Playlist } from '@/domain/entities/Playlist';
import { makeLocalId } from '@/domain/identity/LocalId';
import { useApi } from '@/providers/registry/useApi';
import { fetchAlbumSongsSettled } from './useLazyCollectionDetails';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { usePlaying } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useTracks } from '@/features/song/useTracks';
import { useTheme } from '@/features/theme/useTheme';
import { useTranslation } from 'react-i18next';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import { iconSize } from '@/constants/design';
import {
  OptionSheetDivider,
  OptionSheetHeader,
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from './OptionSheetPrimitives';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';

type GenreOptionsProps = {
  genre: string;
  albums: Album[];
};

const GenreOptions = forwardRef<BottomSheetModal, GenreOptionsProps>(({ genre, albums }, ref) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const api = useApi();
  const queryClient = useQueryClient();
  const activeServer = useSelector(selectActiveServer);

  const {
    playSongInCollection,
    addCollectionToQueue,
    shuffleCollectionToQueue,
    getQueue,
    currentSong,
    playNext,
  } = usePlaying();

  const { downloadAlbumById, getCollectionDownloadState } = useDownload();
  const { tracks } = useTracks();

  const snapPoints = useMemo(() => ['40%', '70%'], []);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();

  const albumIds = useMemo(() => new Set(albums.map(a => a.localId)), [albums]);
  const genreTrackIds = useMemo(
    () => tracks.filter(track => albumIds.has(track.album.localId)).map(track => track.localId),
    [albumIds, tracks]
  );
  const { isDownloaded: isFullyDownloaded, isDownloading } = getCollectionDownloadState(genreTrackIds);

  const close = () => {
    dismissSheetRef(ref);
  };

  const fetchGenreSongs = async (): Promise<Song[]> => {
    if (!activeServer?.id || !albums.length) return [];
    return fetchAlbumSongsSettled({
      queryClient,
      serverId: activeServer.id,
      albums,
      getAlbum: api.albums.get,
    });
  };

  const ensureSongsLoaded = async (): Promise<Song[]> => {
    if (songs.length) return songs;
    setSongsLoading(true);
    try {
      const loaded = await fetchGenreSongs();
      setSongs(loaded);
      return loaded;
    } finally {
      setSongsLoading(false);
    }
  };

  /**
   * A genre has no real playlist behind it either — see the equivalent
   * comment on `ArtistOptions.buildCollection`. Scoped under the first
   * album's provenance (there is no other origin to namespace under) since
   * every album shown for one genre in this sheet comes from the same
   * active server.
   */
  const genreCollection = (loadedSongs: Song[]): { playlist: Playlist; songs: Song[] } => {
    const provenance = albums[0]?.provenance ?? { origin: 'server' as const, serverId: '' };
    const playlist: Playlist = {
      localId: makeLocalId('playlist', provenance, `genre:${genre}`),
      nativeId: genre,
      provenance,
      externalIds: {},
      libraryState: 'in-library',
      title: genre,
      cover: albums[0]?.cover ?? { kind: 'none' },
      isOwned: false,
      songIds: loadedSongs.map(song => song.localId),
    };
    return { playlist, songs: loadedSongs };
  };

  const handleAddToNext = async () => {
    const loaded = await ensureSongsLoaded();
    if (!loaded.length) return;
    if (!currentSong) {
      notify.error(t('songOptions.toasts.nothingPlaying'));
      return;
    }
    [...loaded].reverse().forEach(song => playNext(song));
    notify.success(t('genreOptions.toasts.addedNext', { genre }));
    close();
  };

  const handleAddToEnd = async () => {
    const loaded = await ensureSongsLoaded();
    if (!loaded.length) return;
    const collection = genreCollection(loaded);
    const hasQueue = getQueue().length > 0;
    if (!hasQueue) {
      playSongInCollection(loaded[0], collection, false);
    } else {
      addCollectionToQueue(collection);
      notify.success(t('genreOptions.toasts.addedToEnd', { genre }));
    }
    close();
  };

  const handleShuffleToQueue = async () => {
    const loaded = await ensureSongsLoaded();
    if (!loaded.length) return;
    const collection = genreCollection(loaded);
    const hasQueue = getQueue().length > 0;
    if (!hasQueue) {
      playSongInCollection(loaded[0], collection, true);
    } else {
      shuffleCollectionToQueue(collection);
      notify.success(t('genreOptions.toasts.shuffledToQueue', { genre }));
    }
    close();
  };

  const handleDownloadAll = async () => {
    if (isDownloadingAll || isDownloading || isFullyDownloaded || !albums.length) return;
    setIsDownloadingAll(true);
    try {
      await Promise.all(albums.map(album => downloadAlbumById(album.nativeId)));
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      stackBehavior="push"
      onChange={(index) => setIsSheetOpen(index >= 0)}
    >
      <BottomSheetScrollView
        style={sheetBg}
        contentContainerStyle={sheetContent}
      >
        <OptionSheetHeader
          cover={albums[0]?.cover ?? { kind: 'none' }}
          title={genre}
          subtitle={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}
        />

        <OptionSheetDivider />

        <OptionSheetRow
          icon={<ListStart size={iconSize.loader} color={colors.secondary} />}
          label={t('genreOptions.actions.addToNext')}
          onPress={() => void handleAddToNext()}
          loading={songsLoading && isSheetOpen}
        />
        <OptionSheetRow
          icon={<ListEnd size={iconSize.loader} color={colors.secondary} />}
          label={t('genreOptions.actions.addToEnd')}
          onPress={() => void handleAddToEnd()}
          loading={songsLoading && isSheetOpen}
        />
        <OptionSheetRow
          icon={<Shuffle size={iconSize.loader} color={colors.secondary} />}
          label={t('genreOptions.actions.shuffleToQueue')}
          onPress={() => void handleShuffleToQueue()}
          loading={songsLoading && isSheetOpen}
        />
        <OptionSheetRow
          icon={
            isDownloadingAll || isDownloading ? undefined
              : isFullyDownloaded ? <Check size={iconSize.loader} color={colors.secondary} />
                : <ArrowDownCircle size={iconSize.loader} color={colors.secondary} />
          }
          label={
            isDownloadingAll || isDownloading ? t('genreOptions.actions.downloading')
              : isFullyDownloaded ? t('genreOptions.actions.downloaded')
                : t('genreOptions.actions.download')
          }
          onPress={() => void handleDownloadAll()}
          loading={isDownloadingAll || isDownloading}
          dimLabel={isFullyDownloaded}
          disabled={isDownloadingAll || isDownloading || isFullyDownloaded}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

GenreOptions.displayName = 'GenreOptions';

export default GenreOptions;
