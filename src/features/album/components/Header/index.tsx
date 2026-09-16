import { iconSize, onDark, spacing, statusColor } from '@/constants/design';
import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
} from 'react-native';
import { Ellipsis, Shuffle, Play, CloudDownload, Link } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { Album } from '@/domain/entities/Album';
import type { Song } from '@/domain/entities/Song';
import type { Playlist } from '@/domain/entities/Playlist';
import type { CoverSource } from '@/domain/entities/Cover';
import { makeLocalId } from '@/domain/identity/LocalId';
import AlbumOptions from '@/components/options/AlbumOptions';
import GetReviewSheet from '@/components/options/GetReviewSheet';
import StatusBanner from '@/components/StatusBanner';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import DownloadStateIcon from '@/components/DownloadStateIcon';
import { useCollectionDownloadProgress } from '@/features/downloads/useCollectionDownloadProgress';

import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useTheme } from '@/features/theme/useTheme';
import { useSheetRef } from '@/components/useSheetRef';
import { formatDuration } from '@/components/formatDuration';
import { useAnyAlbumDownloaderConnected } from '@/features/downloaders/registry';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation';
import { playableSongs } from '@/features/album/trackPlayability';
import type { AlbumScreenModel } from '@/features/album/useAlbumScreenModel';
import {
  DetailActionRow,
  DetailCircleAction,
  DetailHeader,
  DetailHeaderBar,
  DetailHeaderIconButton,
  DetailMetaDot,
  DetailMetaRow,
  DetailMetaText,
  DetailPlayAction,
} from '@/components/DetailHeader';
import Touchable from '@/components/Touchable';

type Props = {
  model: AlbumScreenModel;
  showNavigation?: boolean;
};

const NO_COVER: CoverSource = { kind: 'none' };

function isCountLikeAlbumText(value?: string | null): boolean {
  return /^\s*\d+\s+albums?\s*$/i.test(value ?? '');
}

const AlbumHeader: React.FC<Props> = ({ model, showNavigation = true }) => {
  const { album, isLocal, songs } = model;
  const displayTitle = album?.title ?? '';
  // A missing cover is filled where it is drawn, by the same rule as every tile.
  const displayCover = album?.cover ?? NO_COVER;

  return (
    <DetailHeader
      title={displayTitle}
      cover={displayCover}
      rightAction={album ? <AlbumOptionsButton album={album} isLocal={isLocal} /> : undefined}
      meta={isLocal ? <LocalMetaRow album={album} songs={songs} /> : <ExternalMetaRow album={album} songs={songs} />}
      status={!isLocal ? <ExternalServerStatusRow model={model} /> : undefined}
      actions={isLocal ? <LocalActionRow model={model} /> : <ExternalActionRow model={model} />}
      showNavigation={showNavigation}
    />
  );
};

export const AlbumHeaderBar: React.FC<Props> = ({ model }) => {
  const displayTitle = model.album?.title ?? '';
  return (
    <DetailHeaderBar
      title={displayTitle}
      rightAction={model.album ? <AlbumOptionsButton album={model.album} isLocal={model.isLocal} /> : undefined}
    />
  );
};

/**
 * The "…" on an album's bar.
 *
 * On both kinds of album, not only a library one: a browsed album had no
 * options at all, so there was no way to want it, send it to a downloader, or
 * reach its artist from the screen that is about it. `AlbumOptions` picks the
 * action set from the album's own provenance, so this button says the same
 * thing on either. `hideGoToAlbum` only means anything for a library album —
 * the external set has no such row — and is passed for the same reason it is
 * everywhere else: this *is* the album screen.
 */
function AlbumOptionsButton({ album, isLocal }: { album: Album; isLocal: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const optionsSheetRef = useSheetRef();
  return (
    <>
      <DetailHeaderIconButton
        accessibilityLabel={t('a11y.common.moreOptions')}
        onPress={() => optionsSheetRef.current?.present()}
      >
        <Ellipsis size={iconSize.header} color={colors.secondary} />
      </DetailHeaderIconButton>
      <AlbumOptions ref={optionsSheetRef} album={album} hideGoToAlbum={isLocal} />
    </>
  );
}

function LocalMetaRow({ album, songs }: { album: Album | null; songs: Song[] }) {
  const navigation = useNavigation<any>();

  const totalDuration = useMemo(
    () => songs.reduce((sum, song) => sum + song.durationSeconds, 0),
    [songs]
  );

  const metadataItems = useMemo(() => {
    const items: { label: string; type: 'artist' | 'genre' | 'info' }[] = [];
    if (!album) return items;
    if (album.artist.name) items.push({ label: album.artist.name, type: 'artist' });
    const genre = album.genres?.[0]?.trim();
    if (genre) items.push({ label: genre, type: 'genre' });
    const year = Number(album.year);
    if (Number.isFinite(year) && year > 0) items.push({ label: String(year), type: 'info' });
    if (!items.length) {
      items.push({ label: `${songs.length} songs`, type: 'info' });
      items.push({ label: formatDuration(totalDuration), type: 'info' });
    }
    return items;
  }, [album, songs.length, totalDuration]);

  const handleGenrePress = useCallback((genre: string) => {
    navigation.push('genreView', { genre });
  }, [navigation]);

  if (!album) return null;

  return (
    <DetailMetaRow>
      {metadataItems.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 && <DetailMetaDot />}
          {item.type === 'artist' ? (
            <Touchable onPress={() => navigation.push('artistView', { id: album.artist.nativeId })}>
              <DetailMetaText>{item.label}</DetailMetaText>
            </Touchable>
          ) : item.type === 'genre' ? (
            <Touchable onPress={() => handleGenrePress(item.label)}>
              <DetailMetaText>{item.label}</DetailMetaText>
            </Touchable>
          ) : (
            <DetailMetaText>{item.label}</DetailMetaText>
          )}
        </React.Fragment>
      ))}
    </DetailMetaRow>
  );
}

function ExternalMetaRow({ album, songs }: { album: Album | null; songs: Song[] }) {
  const { t } = useTranslation();
  const { navigateToArtist } = useMatchedNavigation();

  const metadataItems = useMemo(() => {
    const items: string[] = [];
    if (!album) return items;
    if (album.artist.name && !isCountLikeAlbumText(album.artist.name)) items.push(album.artist.name);
    if (songs.length > 0) items.push(t('externalAlbum.header.songs', { count: songs.length }));
    return [...new Set(items.map(item => item.trim()).filter(Boolean))];
  }, [album, songs.length, t]);

  // The artist reference carried on the album is a thin `ArtistRef`, not a
  // full domain `Artist` — this builds a minimal-but-valid one to navigate
  // with, taking provenance/libraryState from the album itself since the
  // referenced artist has no record of its own here.
  const handleNavigateToArtist = useCallback(() => {
    if (!album) return;
    navigateToArtist({
      localId: album.artist.localId,
      nativeId: album.artist.nativeId,
      provenance: album.provenance,
      externalIds: album.artist.externalIds,
      libraryState: 'external',
      name: album.artist.name,
      cover: album.artist.cover,
      tags: [],
      albumIds: [],
    });
  }, [album, navigateToArtist]);

  if (!album) return null;

  return (
    <DetailMetaRow>
      {metadataItems.map((item, index) => (
        <React.Fragment key={`${item}-${index}`}>
          {index > 0 && <DetailMetaDot />}
          {index === 0 && album.artist.name ? (
            <Touchable onPress={handleNavigateToArtist}>
              <DetailMetaText>{item}</DetailMetaText>
            </Touchable>
          ) : (
            <DetailMetaText>{item}</DetailMetaText>
          )}
        </React.Fragment>
      ))}
    </DetailMetaRow>
  );
}

function ExternalServerStatusRow({ model }: { model: AlbumScreenModel }) {
  const { t } = useTranslation();
  const albumStatus = model.externalStatus;

  if (albumStatus.kind === 'none') return null;

  if (albumStatus.kind === 'in_library') {
    return (
      <StatusBanner
        icon={<Link size={iconSize.badge} color={statusColor.success} />}
        text={t('externalAlbum.serverStatus.onServer')}
        color={statusColor.success}
        style={styles.serverStatusRow}
      />
    );
  }
  return (
    <StatusBanner
      icon={<SpinningLoaderCircle size={iconSize.badge} color={statusColor.downloading} />}
      text={t('externalAlbum.serverStatus.downloadingToServer', { progress: albumStatus.progress })}
      color={statusColor.downloading}
      style={styles.serverStatusRow}
    />
  );
}

function LocalActionRow({ model }: { model: AlbumScreenModel }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { playSongInCollection } = usePlayingActions();
  const { downloadAlbumById, cancelCollectionDownloads, getCollectionDownloadState } = useDownload();
  const { album, songs } = model;

  const songIds = useMemo(() => songs.map(s => s.localId), [songs]);
  const { isDownloaded: isAlbumDownloaded, isDownloading: isAlbumDownloading } =
    getCollectionDownloadState(songIds);
  const downloadFraction = useCollectionDownloadProgress(songIds);

  const toggleDownload = useCallback(async () => {
    if (!album) return;
    if (isAlbumDownloading) {
      await cancelCollectionDownloads(album.nativeId);
      return;
    }
    if (!songs.length || isAlbumDownloaded) return;
    await downloadAlbumById(album.nativeId, songs);
  }, [album, songs, isAlbumDownloading, isAlbumDownloaded, downloadAlbumById, cancelCollectionDownloads]);

  const handlePlay = useCallback(() => {
    if (album && songs.length > 0) playSongInCollection(songs[0], { album, songs }, false);
  }, [songs, album, playSongInCollection]);

  const handleShuffle = useCallback(() => {
    if (album && songs.length > 0) playSongInCollection(songs[0], { album, songs }, true);
  }, [songs, album, playSongInCollection]);

  return (
    <DetailActionRow>
      <DetailCircleAction onPress={handleShuffle} accessibilityLabel={t('a11y.detail.shuffle')}>
        <Shuffle size={iconSize.row} color={colors.secondary} />
      </DetailCircleAction>

      <DetailPlayAction onPress={handlePlay} accessibilityLabel={t('a11y.detail.play')}>
        <Play size={iconSize.control} color={colors.onThemeColor} fill={colors.onThemeColor} />
      </DetailPlayAction>

      <DetailCircleAction
        onPress={() => void toggleDownload()}
        accessibilityLabel={t(
          isAlbumDownloading
            ? 'a11y.detail.cancelDownload'
            : isAlbumDownloaded
              ? 'a11y.detail.downloaded'
              : 'a11y.detail.download'
        )}
      >
        <DownloadStateIcon
          isDownloaded={isAlbumDownloaded}
          isDownloading={isAlbumDownloading}
          progress={downloadFraction}
          color={colors.secondary}
        />
      </DetailCircleAction>
    </DetailActionRow>
  );
}

function ExternalActionRow({ model }: { model: AlbumScreenModel }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const canDownload = useAnyAlbumDownloaderConnected();
  const { playSongInCollection } = usePlayingActions();
  const { album, songs, playability, externalStatus: albumStatus } = model;
  const downloadSheetRef = useSheetRef();

  const previewSongs = useMemo(() => playableSongs(songs, playability), [songs, playability]);

  // There is no real playlist behind "play the previews we could resolve" —
  // it's a transient queue seed, not a server object — so this builds a
  // minimal-but-valid domain `Playlist` wrapper, namespaced under the
  // external album's own provenance since that's the only origin these
  // preview tracks have. Mirrors the equivalent build in
  // `components/options/ArtistOptions`.
  const previewCollection = useMemo<{ playlist: Playlist; songs: Song[] } | null>(() => {
    if (!album) return null;
    const provenance = album.provenance;
    const playlist: Playlist = {
      localId: makeLocalId('playlist', provenance, `preview-${album.nativeId}`),
      nativeId: album.nativeId,
      provenance,
      externalIds: {},
      libraryState: 'external',
      title: album.title,
      cover: album.cover,
      isOwned: false,
      songIds: previewSongs.map(s => s.localId),
    };
    return { playlist, songs: previewSongs };
  }, [album, previewSongs]);

  const handlePlay = useCallback(() => {
    if (!previewSongs.length || !previewCollection) return;
    playSongInCollection(previewSongs[0], previewCollection);
  }, [previewSongs, previewCollection, playSongInCollection]);

  const handleDownload = useCallback(() => {
    if (albumStatus.kind !== 'none') return;
    // Nothing connected to send it to: say so and offer to connect one, rather
    // than a greyed-out button that swallows the tap.
    if (!canDownload) {
      promptConnectDownloader('album');
      return;
    }
    downloadSheetRef.current?.present();
  }, [canDownload, albumStatus.kind, downloadSheetRef]);

  if (!album) return null;

  return (
    <>
      <DetailActionRow>
        <DetailPlayAction
          onPress={handleDownload}
          disabled={albumStatus.kind !== 'none'}
          accessibilityLabel={t('a11y.detail.downloadToServer')}
        >
          <CloudDownload
            size={iconSize.control}
            color={!canDownload || albumStatus.kind !== 'none' ? 'rgba(255,255,255,0.4)' : onDark.text}
          />
        </DetailPlayAction>

        {previewSongs.length > 0 && (
          <DetailCircleAction onPress={handlePlay} accessibilityLabel={t('a11y.detail.playPreview')}>
            <Play size={iconSize.row} color={colors.secondary} fill={colors.secondary} />
          </DetailCircleAction>
        )}
      </DetailActionRow>

      <GetReviewSheet album={album} sheetRef={downloadSheetRef} />
    </>
  );
}

export default AlbumHeader;

const styles = StyleSheet.create({
  serverStatusRow: {
    marginBottom: spacing.controlGap,
  },
});
