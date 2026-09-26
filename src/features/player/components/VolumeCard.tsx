import { useTheme } from '@/features/theme/useTheme';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Slider from '@react-native-community/slider';
import { Volume2, VolumeX, Volume1 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { usePlayingActions, usePlayingState } from '@/features/playback/PlayingContext';
import { usePlaybackSink } from '@/features/player/PlaybackSinkContext';
import { iconSize, onDark, onDarkAlpha, spacing, typography, veil } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { selection } from '@/components/haptics';

type Props = { contentWidth: number };

/**
 * In-app volume slider — controls the player's own gain (0..1), independent
 * of the device's system volume. Off by default so the standard player looks
 * unchanged; enable under Settings › Player.
 *
 * While the server's own speakers play (the jukebox), it is the jukebox's
 * gain instead: the slider shows the gain the server reports, and a drag
 * shows where the finger is until it lets go, so a poll landing mid-drag does
 * not pull the thumb back.
 */
export default function VolumeCard({ contentWidth }: Props) {
  const { t } = useTranslation();
  const themeColor = useTheme().colors.themeColor;
  const rad = useRadius();
  const { volume: playerVolume } = usePlayingState();
  const { setVolume } = usePlayingActions();
  const { sink, jukeboxState } = usePlaybackSink();
  const [dragging, setDragging] = useState<number | null>(null);

  const onServer = sink.kind === 'jukebox';
  const reported = onServer && jukeboxState ? jukeboxState.gain : playerVolume;
  const volume = dragging ?? reported;

  const handleChange = useCallback((next: number) => {
    setDragging(next);
    setVolume(next);
  }, [setVolume]);

  const handleSlidingComplete = useCallback(() => {
    setDragging(null);
    selection();
  }, []);

  const Icon = volume <= 0.01 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const percent = Math.round(volume * 100);
  const isMuted = volume <= 0.01;

  return (
    <View
      style={[
        styles.card,
        { width: contentWidth, borderRadius: rad.panel },
      ]}
    >
      <View style={styles.headerRow}>
        <Icon size={iconSize.inline} color={isMuted ? themeColor : onDarkAlpha.quiet} />
        <Text style={[styles.label, isMuted && { color: themeColor }]}>
          {t(onServer ? 'playing.volumeOnServer' : 'playing.volume')}
        </Text>
        <View style={styles.spacer} />
        <Text style={styles.percent}>{percent}%</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        value={volume}
        onValueChange={handleChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={themeColor}
        maximumTrackTintColor={veil.track}
        thumbTintColor={themeColor}
        accessibilityLabel={t(onServer ? 'playing.volumeOnServer' : 'playing.volume')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: veil.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: onDarkAlpha.quiet,
  },
  spacer: { flex: 1 },
  percent: {
    ...typography.caption,
    fontWeight: '500',
    color: onDark.subtext,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
