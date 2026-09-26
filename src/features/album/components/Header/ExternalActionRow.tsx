import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudDownload, Heart, Play } from 'lucide-react-native';

import { DetailActionRow, DetailCircleAction, DetailPlayAction } from '@/components/DetailHeader';
import GetReviewSheet from '@/components/options/GetReviewSheet';
import { useSheetRef } from '@/components/useSheetRef';
import { iconSize, onDark, onDarkAlpha, statusColor } from '@/constants/design';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import type { AlbumScreenModel } from '@/features/album/useAlbumScreenModel';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';
import { useAnyAlbumDownloaderConnected } from '@/features/downloaders/registry';
import { useWantToggle } from '@/features/entity-actions/shared/wantActions';
import { playableSongs } from '@/features/album/trackPlayability';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';

/**
 * Get, play-a-preview and Want for an album nobody's server has.
 *
 * Split out of the header when it crossed the file-shape gate, which is the
 * same place the artist header already keeps its two rows. Nothing here
 * changed in the move except the Want beside the Get.
 */
export default function ExternalActionRow({ model }: { model: AlbumScreenModel }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const canDownload = useAnyAlbumDownloaderConnected();
  const { playSongInCollection } = usePlayingActions();
  const { album, songs, playability, externalStatus: albumStatus } = model;
  const downloadSheetRef = useSheetRef();
  const { isWanted, toggle: toggleWant } = useWantToggle(album?.localId, 'album', 'artist-page');

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
      title: album.title,
      cover: album.cover,
      isOwned: false,
      songIds: previewSongs.map((song: Song) => song.localId),
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
            color={!canDownload || albumStatus.kind !== 'none' ? onDarkAlpha.disabled : onDark.text}
          />
        </DetailPlayAction>

        {previewSongs.length > 0 && (
          <DetailCircleAction onPress={handlePlay} accessibilityLabel={t('a11y.detail.playPreview')}>
            <Play size={icons.row} color={colors.secondary} fill={colors.secondary} />
          </DetailCircleAction>
        )}

        {/* Want beside Get, rather than only inside the `⋯`. They are the two
            things you can do with a record nobody has, and one of them was two
            taps further away than the other for no reason the screen showed. */}
        <DetailCircleAction
          onPress={() => toggleWant({
            externalIds: album.externalIds,
            title: album.title,
            artist: album.artist.name,
            cover: album.cover,
          })}
          accessibilityLabel={t(isWanted ? 'a11y.detail.wanted' : 'a11y.detail.want')}
        >
          <Heart
            size={icons.row}
            color={isWanted ? statusColor.success : colors.secondary}
            fill={isWanted ? statusColor.success : 'none'}
          />
        </DetailCircleAction>
      </DetailActionRow>

      <GetReviewSheet album={album} sheetRef={downloadSheetRef} />
    </>
  );
}
