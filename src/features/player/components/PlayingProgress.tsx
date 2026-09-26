import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';

import { onDark, spacing, typography } from '@/constants/design';
import { usePlayingActions, usePlayingProgress } from '@/features/playback/PlayingContext';
import { SeekableProgressBar } from './SeekableProgressBar';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * The seek bar and the two timestamps under the player's title.
 *
 * Isolated so the once-a-second progress tick only re-renders these three
 * things, not the cover art / title / artist / add button above them — same
 * reasoning as ProgressBarStrip in the mini player (PlayingBarBase).
 */
const PlayingProgressSection: React.FC<{ songDuration: number }> = memo(({ songDuration }) => {
  const { seekSong } = usePlayingActions();
  const progress = usePlayingProgress();
  const nativeDuration = progress.duration;
  const duration = nativeDuration > 0 ? nativeDuration : songDuration;
  const position = Math.min(progress.position, duration);

  return (
    <>
      <SeekableProgressBar
        value={position}
        duration={duration}
        onSeek={seekSong}
        fillColor={onDark.text}
        trackColor={onDark.mutedText}
        style={styles.progressBar}
      />

      <View style={styles.timestamps}>
        <Text style={styles.timestamp}>
          {formatTime(position)}
        </Text>
        <Text style={styles.timestamp}>
          -{formatTime(duration - position)}
        </Text>
      </View>
    </>
  );
});
PlayingProgressSection.displayName = 'PlayingProgressSection';

export default PlayingProgressSection;

const styles = StyleSheet.create({
  progressBar: {
    marginTop: spacing.sm,
  },
  timestamps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.controlGap,
  },
  timestamp: {
    ...typography.caption,
    color: onDark.subtext,
  },
});
