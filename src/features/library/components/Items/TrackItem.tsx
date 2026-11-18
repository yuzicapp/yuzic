import React, { memo, useRef } from "react";
import { InteractionManager } from "react-native";
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext';
import { usePlayingActions } from "@/features/playback/PlayingContext";
import type { Song } from '@/domain/entities/Song';
import { useTranslation } from "react-i18next";
import { notify } from '@/components/toast';
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import { formatDuration } from '@/components/formatDuration';
import { heavy as heavyHaptic } from '@/components/haptics';
import LibraryItem from './LibraryItem';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/** A second tap inside this window is the same tap. */
const TRACK_PRESS_COOLDOWN_MS = 700;
/** How long a tap waits for the full track before giving up. */
const FULL_TRACK_FETCH_TIMEOUT_MS = 3000;

type Props = {
  song: Song;
  isGridView: boolean;
  gridWidth: number;
  gridSpacing?: number;
};

const TrackItem: React.FC<Props> = ({ song, isGridView, gridWidth, gridSpacing }) => {
  const { t } = useTranslation();
  const { playSimilar, playSong } = usePlayingActions();
  const { resolvePlayableSong } = usePlayableSongResolver();
  const { openSongOptions } = useSongActionSheets();

  const pressInFlightRef = useRef(false);
  const longPressInFlightRef = useRef(false);
  const lastPressAtRef = useRef(0);

  const handlePress = async () => {
    const now = Date.now();
    if (now - lastPressAtRef.current < TRACK_PRESS_COOLDOWN_MS) return;
    if (pressInFlightRef.current) return;
    lastPressAtRef.current = now;
    pressInFlightRef.current = true;
    try {
      // Resolved by the origin's own id: the resolver looks the track up
      // fresh rather than trusting fields this row happens to hold.
      const resolved = await resolvePlayableSong(song.nativeId, { timeoutMs: FULL_TRACK_FETCH_TIMEOUT_MS });
      if (!resolved) {
        notify.error(t("common.playbackError"));
        return;
      }
      if (resolved.filePath) {
        await playSong(resolved.song);
        return;
      }
      await new Promise<void>((resolve) =>
        InteractionManager.runAfterInteractions(() => resolve())
      );
      await playSimilar(resolved.song);
    } catch (error) {
      log.playback.warn('could not play track', { songId: song.nativeId, detail: detailOf(error) });
      notify.error(t("common.playbackError"));
    } finally {
      pressInFlightRef.current = false;
    }
  };

  const handleLongPress = async () => {
    if (longPressInFlightRef.current) return;
    longPressInFlightRef.current = true;
    heavyHaptic();
    try {
      // Resolved by the origin's own id: the resolver looks the track up
      // fresh rather than trusting fields this row happens to hold.
      const resolved = await resolvePlayableSong(song.nativeId, { timeoutMs: FULL_TRACK_FETCH_TIMEOUT_MS });
      if (resolved) {
        openSongOptions(resolved.song);
      } else {
        notify.error(t("common.songDetailsError"));
      }
    } catch (error) {
      log.library.warn('could not fetch full track', { songId: song.nativeId, detail: detailOf(error) });
      notify.error(t("common.songDetailsError"));
    } finally {
      longPressInFlightRef.current = false;
    }
  };

  const duration = song.durationSeconds;
  const subtext = isGridView
    ? song.artist.name
    : `${song.artist.name}${duration ? ` • ${formatDuration(duration)}` : ""}`;

  return (
    <>
      <LibraryItem
        testID="library-track-item"
        cover={song.cover}
        title={song.title}
        subtext={subtext}
        isGridView={isGridView}
        gridWidth={gridWidth}
        gridSpacing={gridSpacing}
        onPress={() => { void handlePress(); }}
        onLongPress={() => { void handleLongPress(); }}
      />
    </>
  );
};

export default memo(TrackItem);
