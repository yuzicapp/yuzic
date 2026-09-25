import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { clampSpeed, type SpeedProfile } from '@/features/playback/speedProfile';

import type { AudioQuality, PreferredCodec } from '@/domain/playback/AudioFormat';

export type { AudioQuality };

interface PlaybackSettingsState {
  wifiStreamQuality: AudioQuality;
  cellularStreamQuality: AudioQuality;
  downloadQuality: AudioQuality;
  preferredCodec: PreferredCodec;
  autoplayEnabled: boolean;
  resumeLongTracksEnabled: boolean;
  queueSyncEnabled: boolean;
  showVolumeSlider: boolean;
  showJumpButtons: boolean;
  showPlaybackSpeed: boolean;
  /**
   * Five stars under the title on the player.
   *
   * The one member of this family that defaults *on*, and the reason is that
   * the others duplicate something already reachable: the volume slider has
   * the hardware keys, the speed dial and the jump buttons have their own
   * cards and gestures. A rating has nowhere else to be on the player, and
   * rating the track that is playing without opening anything is the thing
   * people ask for when they ask for ratings at all.
   *
   * It costs nothing on a server without them: the row reads the adapter's
   * `ratings` surface as well as this switch, so it never appears on
   * Jellyfin, Emby, Plex or local files whatever this says.
   */
  showRating: boolean;
  /**
   * Remembered playback rate per kind of listening — see
   * `utils/playback/speedProfile`. Two entries rather than one because a
   * listener wants one speed for talking and another for music; a single
   * global rate followed you out of a podcast into the next song and reset to
   * 1× on every launch.
   */
  playbackSpeeds: Partial<Record<SpeedProfile, number>>;
  /**
   * Seconds of overlap between tracks. `0` is off, which is the default —
   * crossfade is a taste, not an improvement, and a player that fades by
   * default is one that has decided for you.
   */
  crossfadeSeconds: number;
  /** Fade through segues too, rather than hard-cutting where they join. */
  crossfadeAlways: boolean;
  /** Per-band gains in dB, in `EQ_FREQUENCIES` order. All zero is flat. */
  equalizerGains: number[];
  /**
   * Level every track to the same loudness, using the server's own measurement.
   *
   * Off by default, because it is only ever as good as the tags: on a library
   * nobody has scanned it does nothing, and a listener who turns it on and
   * hears no change should be told why rather than left to guess. The engine
   * has applied this since it was written — nothing had ever given it the
   * figures.
   */
  loudnessNormalization: boolean;
  /**
   * Extra gain on top of the correction, in dB.
   *
   * ReplayGain levels *down* to a reference, so a fully normalised library is
   * quieter than its loudest tracks were. This gives that headroom back for
   * people who would rather turn the phone up less; clipping is held off by
   * the engine's own peak guard, which is why this can be offered at all.
   */
  loudnessPreampDb: number;
}

const initialState: PlaybackSettingsState = {
  wifiStreamQuality: 'original',
  cellularStreamQuality: 'high',
  downloadQuality: 'high',
  preferredCodec: 'mp3',
  autoplayEnabled: true,
  // Default-on: cross-device continuity and resume are what the user asked
  // for by pausing an audiobook or opening the app on a tablet.
  resumeLongTracksEnabled: true,
  queueSyncEnabled: true,
  showVolumeSlider: false,
  showJumpButtons: false,
  showPlaybackSpeed: false,
  showRating: true,
  playbackSpeeds: {},
  crossfadeSeconds: 0,
  crossfadeAlways: false,
  equalizerGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  loudnessNormalization: false,
  loudnessPreampDb: 0,
};

const playbackSlice = createSlice({
  name: 'settingsPlayback',
  initialState,
  reducers: {
    setWifiStreamQuality(state, action: PayloadAction<AudioQuality>) {
      state.wifiStreamQuality = action.payload;
    },
    setCellularStreamQuality(state, action: PayloadAction<AudioQuality>) {
      state.cellularStreamQuality = action.payload;
    },
    setDownloadQuality(state, action: PayloadAction<AudioQuality>) {
      state.downloadQuality = action.payload;
    },
    setPreferredCodec(state, action: PayloadAction<PreferredCodec>) {
      state.preferredCodec = action.payload;
    },
    setAutoplayEnabled(state, action: PayloadAction<boolean>) {
      state.autoplayEnabled = action.payload;
    },
    setResumeLongTracksEnabled(state, action: PayloadAction<boolean>) {
      state.resumeLongTracksEnabled = action.payload;
    },
    setQueueSyncEnabled(state, action: PayloadAction<boolean>) {
      state.queueSyncEnabled = action.payload;
    },
    setShowVolumeSlider(state, action: PayloadAction<boolean>) {
      state.showVolumeSlider = action.payload;
    },
    setShowJumpButtons(state, action: PayloadAction<boolean>) {
      state.showJumpButtons = action.payload;
    },
    setShowPlaybackSpeed(state, action: PayloadAction<boolean>) {
      state.showPlaybackSpeed = action.payload;
    },
    setShowRating(state, action: PayloadAction<boolean>) {
      state.showRating = action.payload;
    },
    /** Remember a rate for one kind of listening. Clamped here so a bad value
     *  cannot reach the engine even if something writes one. */
    setPlaybackSpeedForProfile(
      state,
      action: PayloadAction<{ profile: SpeedProfile; speed: number }>
    ) {
      if (!state.playbackSpeeds) state.playbackSpeeds = {};
      state.playbackSpeeds[action.payload.profile] = clampSpeed(action.payload.speed);
    },
    setCrossfadeSeconds(state, action: PayloadAction<number>) {
      state.crossfadeSeconds = action.payload;
    },
    setCrossfadeAlways(state, action: PayloadAction<boolean>) {
      state.crossfadeAlways = action.payload;
    },
    setEqualizerGains(state, action: PayloadAction<number[]>) {
      state.equalizerGains = action.payload;
    },
    setLoudnessNormalization(state, action: PayloadAction<boolean>) {
      state.loudnessNormalization = action.payload;
    },
    setLoudnessPreampDb(state, action: PayloadAction<number>) {
      // Clamped here rather than at the slider: the engine takes any number and
      // a persisted rogue value would survive every launch.
      state.loudnessPreampDb = Math.min(Math.max(action.payload, -15), 15);
    },
  },
});

export const {
  setWifiStreamQuality,
  setCellularStreamQuality,
  setDownloadQuality,
  setPreferredCodec,
  setAutoplayEnabled,
  setResumeLongTracksEnabled,
  setQueueSyncEnabled,
  setShowVolumeSlider,
  setShowJumpButtons,
  setShowPlaybackSpeed,
  setShowRating,
  setPlaybackSpeedForProfile,
  setCrossfadeSeconds,
  setCrossfadeAlways,
  setEqualizerGains,
  setLoudnessNormalization,
  setLoudnessPreampDb,
} = playbackSlice.actions;

export default playbackSlice.reducer;

interface PlaybackRootState {
  settingsPlayback: PlaybackSettingsState;
}

export const selectWifiStreamQuality = (state: PlaybackRootState): AudioQuality =>
  state.settingsPlayback.wifiStreamQuality;

export const selectCellularStreamQuality = (state: PlaybackRootState): AudioQuality =>
  state.settingsPlayback.cellularStreamQuality;

export const selectDownloadQuality = (state: PlaybackRootState): AudioQuality =>
  state.settingsPlayback.downloadQuality;

export const selectPreferredCodec = (state: PlaybackRootState): PreferredCodec =>
  state.settingsPlayback.preferredCodec;

export const selectAutoplayEnabled = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.autoplayEnabled;

export const selectResumeLongTracksEnabled = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.resumeLongTracksEnabled;

export const selectQueueSyncEnabled = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.queueSyncEnabled;

export const selectShowVolumeSlider = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.showVolumeSlider;

export const selectShowJumpButtons = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.showJumpButtons;

export const selectShowPlaybackSpeed = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.showPlaybackSpeed;

// Defaulted in the selector rather than read straight off the persisted blob:
// an install that predates the key has no value for it, and an undefined
// reaching a conditional render is the switch silently reading as off for
// every existing user. Same rule as the appearance scales.
export const selectShowRating = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.showRating ?? true;

/**
 * Remembered rates per kind of listening. Read through `speedFor`, never
 * straight off this.
 */
export const selectPlaybackSpeeds = (state: PlaybackRootState): Partial<Record<SpeedProfile, number>> =>
  state.settingsPlayback.playbackSpeeds;

export const selectCrossfadeSeconds = (state: PlaybackRootState): number =>
  state.settingsPlayback.crossfadeSeconds;

export const selectCrossfadeAlways = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.crossfadeAlways;

export const selectEqualizerGains = (state: PlaybackRootState): number[] =>
  state.settingsPlayback.equalizerGains;

export const selectLoudnessNormalization = (state: PlaybackRootState): boolean =>
  state.settingsPlayback.loudnessNormalization;

export const selectLoudnessPreampDb = (state: PlaybackRootState): number =>
  state.settingsPlayback.loudnessPreampDb;
