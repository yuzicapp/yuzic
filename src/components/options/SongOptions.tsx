import React, { forwardRef, useMemo } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { Song } from '@/domain/entities/Song';
import type { Album } from '@/domain/entities/Album';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '@/components/formatDuration';
import { formatDate } from '@/components/formatDate';
import { useSheetRef } from '@/components/useSheetRef';
import GetReviewSheet from '@/components/options/GetReviewSheet';
import {
  OptionSheetChipsRow,
  OptionSheetDivider,
  OptionSheetInfoRow,
  OptionSheetSectionLabel,
} from './OptionSheetPrimitives';
import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import RatingSheet from '@/features/ratings/RatingSheet';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import {
  useSongLibraryActions,
  useSongExternalActions,
  useExternalSongAlbumStub,
  useExternalSongTrack,
} from '@/features/entity-actions/hooks/useSongActions';

type SongOptionsProps = {
  selectedSong: Song;
  /** Library-song-only: opens the add-to-playlist sheet. Ignored for external songs. */
  onAddToPlaylist?: () => void;
  /** Library-song-only: opens the sleep timer. Passed by the player, so only the playing track offers it. */
  onSleepTimer?: () => void;
  onNavigate?: () => void;
  /** External-song-only: album context for its options sheet. */
  albumTitle?: string;
  /** External-song-only: album context for its options sheet. */
  albumArtist?: string;
  /** External-song-only: called (and the sheet dismissed) when "Play" is pressed. */
  onPlay?: () => void;
};


/**
 * True when `song` came from an external catalog (Deezer/etc) rather than
 * the user's library — read off `provenance`, the one place that
 * distinction lives now that there is a single `Song` type. Mirrors
 * `isExternalSong` in `components/rows/SongRow`.
 */
function isExternalSongOrigin(song: Song): boolean {
  return song.provenance.origin === 'integration';
}

const SongOptions = forwardRef<BottomSheetModal, SongOptionsProps>(
  ({ selectedSong, onAddToPlaylist, onSleepTimer, onNavigate, albumTitle, albumArtist, onPlay }, ref) => {
    if (isExternalSongOrigin(selectedSong)) {
      return (
        <ExternalSongOptionsSheet
          ref={ref}
          song={selectedSong}
          albumTitle={albumTitle ?? ''}
          albumArtist={albumArtist ?? ''}
          onPlay={onPlay}
        />
      );
    }
    return (
      <LibrarySongOptionsSheet
        ref={ref}
        selectedSong={selectedSong}
        onAddToPlaylist={onAddToPlaylist ?? (() => {})}
        onSleepTimer={onSleepTimer}
        onNavigate={onNavigate}
      />
    );
  }
);

SongOptions.displayName = 'SongOptions';

export default SongOptions;

// ---------------------------------------------------------------------------
// Library song action set.
// ---------------------------------------------------------------------------

type LibrarySongOptionsProps = {
  selectedSong: Song;
  onAddToPlaylist: () => void;
  onSleepTimer?: () => void;
  onNavigate?: () => void;
};

const LibrarySongOptionsSheet = forwardRef<BottomSheetModal, LibrarySongOptionsProps>(
  ({ selectedSong, onAddToPlaylist, onSleepTimer, onNavigate }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['55%', '90%'], []);
    const close = () => dismissSheetRef(ref);
    const ratingSheetRef = useSheetRef();

    const { actions, playCount } = useSongLibraryActions(selectedSong, {
      onAddToPlaylist,
      onRating: () => ratingSheetRef.current?.present(),
      onSleepTimer,
      onNavigate,
      close,
    });

    return (
      <>
      <EntityOptionsSheet
        ref={ref}
        testID="song-options-sheet"
        snapPoints={snapPoints}
        header={{
          cover: selectedSong.cover,
          title: selectedSong.title,
          subtitle: selectedSong.artist.name || t('songOptions.unknownArtist'),
        }}
        actions={actions}
        infoSection={
          <>
            <OptionSheetDivider />
            <OptionSheetSectionLabel label={t('songOptions.sections.media')} />
            <OptionSheetInfoRow label={t('songOptions.media.duration')} value={formatDuration(selectedSong.durationSeconds)} />
            <OptionSheetInfoRow label={t('songOptions.media.plays')} value={playCount} />
            {selectedSong.audio?.bitrateKbps != null && (
              <OptionSheetInfoRow label={t('songOptions.media.bitrate')} value={t('songOptions.media.kbps', { value: selectedSong.audio.bitrateKbps })} />
            )}
            {selectedSong.audio?.sampleRateHz != null && (
              <OptionSheetInfoRow label={t('songOptions.media.sampleRate')} value={t('songOptions.media.hz', { value: selectedSong.audio.sampleRateHz })} />
            )}
            {selectedSong.audio?.bitsPerSample != null && (
              <OptionSheetInfoRow label={t('songOptions.media.bitsPerSample')} value={selectedSong.audio.bitsPerSample} />
            )}
            {selectedSong.audio?.mimeType && (
              <OptionSheetInfoRow label={t('songOptions.media.format')} value={selectedSong.audio.mimeType} valueLines={1} />
            )}
            {(selectedSong.discNumber != null || selectedSong.trackNumber != null) && (
              <>
                <OptionSheetSectionLabel label={t('songOptions.sections.track')} spaced />
                {selectedSong.discNumber != null && (
                  <OptionSheetInfoRow label={t('songOptions.track.disc')} value={selectedSong.discNumber} />
                )}
                {selectedSong.trackNumber != null && (
                  <OptionSheetInfoRow label={t('songOptions.track.track')} value={selectedSong.trackNumber} />
                )}
              </>
            )}
            {(selectedSong.year != null || selectedSong.addedAt != null) && (
              <>
                <OptionSheetSectionLabel label={t('songOptions.sections.dates')} spaced />
                {selectedSong.year != null && (
                  <OptionSheetInfoRow label={t('songOptions.dates.released')} value={formatDate(String(selectedSong.year), { short: true })} />
                )}
                {selectedSong.addedAt != null && (
                  <OptionSheetInfoRow label={t('songOptions.dates.added')} value={formatDate(selectedSong.addedAt, { short: true })} valueLines={1} />
                )}
              </>
            )}
            {(selectedSong.bpm != null || selectedSong.genres.length > 0 || !!selectedSong.audio?.path) && (
              <>
                <OptionSheetSectionLabel label={t('songOptions.sections.other')} spaced />
                {selectedSong.bpm != null && (
                  <OptionSheetInfoRow label={t('songOptions.other.bpm')} value={selectedSong.bpm} />
                )}
                {selectedSong.genres.length > 0 && (
                  <OptionSheetChipsRow label={t('songOptions.other.genres')} values={selectedSong.genres} />
                )}
                {!!selectedSong.audio?.path && (
                  <OptionSheetInfoRow label={t('songOptions.other.filePath')} value={selectedSong.audio.path} />
                )}
              </>
            )}
          </>
        }
      />
      <RatingSheet ref={ratingSheetRef} entity={selectedSong} />
      </>
    );
  }
);

LibrarySongOptionsSheet.displayName = 'LibrarySongOptionsSheet';

// ---------------------------------------------------------------------------
// External song action set.
// ---------------------------------------------------------------------------

type ExternalSongOptionsSheetProps = {
  song: Song;
  albumTitle: string;
  albumArtist: string;
  onPlay?: () => void;
};

const ExternalSongOptionsSheet = forwardRef<BottomSheetModal, ExternalSongOptionsSheetProps>(
  ({ song, albumTitle, albumArtist, onPlay }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['40%', '70%'], []);
    const close = () => dismissSheetRef(ref);

    const downloadSheetRef = useSheetRef();
    const trackDownloadSheetRef = useSheetRef();

    const albumBase: Album = useExternalSongAlbumStub(song, albumTitle);
    const track = useExternalSongTrack(song, albumArtist);

    const { actions } = useSongExternalActions(song, {
      albumTitle, albumArtist, onPlay, close,
      openAlbumGet: () => downloadSheetRef.current?.present(),
      openTrackGet: () => trackDownloadSheetRef.current?.present(),
    });

    const hasAnyPrimaryRow = !!onPlay || actions.length > 0;

    return (
      <>
        <EntityOptionsSheet
          ref={ref}
          snapPoints={snapPoints}
          header={{ cover: song.cover, title: song.title, subtitle: `${albumArtist} — ${albumTitle}` }}
          actions={actions}
          infoSection={
            <>
              {hasAnyPrimaryRow && <OptionSheetDivider />}
              <OptionSheetSectionLabel label={t('songOptions.sections.media')} />
              <OptionSheetInfoRow label={t('songOptions.media.duration')} value={formatDuration(song.durationSeconds)} />
            </>
          }
        />

        <GetReviewSheet album={albumBase} sheetRef={downloadSheetRef} />
        <GetReviewSheet album={albumBase} track={track} sheetRef={trackDownloadSheetRef} />
      </>
    );
  }
);

ExternalSongOptionsSheet.displayName = 'ExternalSongOptionsSheet';
