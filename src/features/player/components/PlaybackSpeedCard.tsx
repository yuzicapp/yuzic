import { iconSize, onDark, onDarkAlpha, spacing, stateLayer, typography, veil } from '@/constants/design';
import { useIconSize } from '@/features/theme/useIconSize';
import { useTheme } from '@/features/theme/useTheme';
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { usePlayingActions, usePlayingState } from '@/features/playback/PlayingContext';
import { DEFAULT_SPEEDS, MAX_SPEED, MIN_SPEED, speedProfileFor } from '@/features/playback/speedProfile';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { withAlpha } from '@/features/theme/coverAccent';

/** One press moves the rate a quarter. */
const SPEED_STEP = 0.25;

type Props = { contentWidth: number };

export default function PlaybackSpeedCard({ contentWidth }: Props) {
  const { t } = useTranslation();
  const icons = useIconSize();
  const themeColor = useTheme().colors.themeColor;
  const rad = useRadius();
  const { playbackSpeed, currentSong } = usePlayingState();
  const { setPlaybackSpeed } = usePlayingActions();
  const isAltered = playbackSpeed !== 1.0;
  // The card says which speed is being changed, because there are now two and
  // a control that silently edits one of them is a control you cannot trust.
  const isSpoken = speedProfileFor(currentSong) === 'spoken';

  const decrease = useCallback(() => {
    const next = Math.round((playbackSpeed - SPEED_STEP) * 100) / 100;
    if (next >= MIN_SPEED) setPlaybackSpeed(next);
  }, [playbackSpeed, setPlaybackSpeed]);

  const increase = useCallback(() => {
    const next = Math.round((playbackSpeed + SPEED_STEP) * 100) / 100;
    if (next <= MAX_SPEED) setPlaybackSpeed(next);
  }, [playbackSpeed, setPlaybackSpeed]);

  const reset = useCallback(() => {
    setPlaybackSpeed(DEFAULT_SPEEDS[isSpoken ? 'spoken' : 'music']);
  }, [isSpoken, setPlaybackSpeed]);

  const canDecrease = playbackSpeed > MIN_SPEED;
  const canIncrease = playbackSpeed < MAX_SPEED;

  return (
    <View
      style={[
        styles.card,
        { width: contentWidth, borderRadius: rad.panel },
        isAltered && { borderColor: withAlpha(themeColor, 0.33), borderWidth: 1 },
      ]}
    >
      {/* Decorative gauge */}
      <View style={styles.gaugeDecor} pointerEvents="none">
        <Gauge
          size={iconSize.decorative}
          color={isAltered ? themeColor : onDark.text}
          strokeWidth={0.8}
          style={{ opacity: stateLayer.decorativeOpacity }}
        />
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Gauge
          size={icons.inline}
          color={isAltered ? themeColor : onDarkAlpha.quiet}
        />
        <Text style={[styles.label, isAltered && { color: themeColor }]}>
          {t(isSpoken ? 'playing.speed.spokenTitle' : 'playing.speed.title')}
        </Text>
      </View>

      {/* Speed display */}
      <Text style={[styles.bigValue, isAltered && { color: onDark.text }]}>
        {playbackSpeed === 1 ? '1' : playbackSpeed}
        <Text style={styles.bigUnit}>×</Text>
      </Text>

      {/* Controls */}
      <View style={styles.controls}>
        <Touchable
          onPress={reset}
          disabled={!isAltered}
          style={[
            styles.resetButton,
            { borderRadius: rad.card },
            isAltered
              ? { borderColor: veil.borderSelected }
              : { borderColor: veil.border },
          ]}
        >
          <Text style={[styles.resetLabel, !isAltered && { opacity: stateLayer.disabledTextOpacity }]}>
            1×
          </Text>
        </Touchable>

        <Touchable
          onPress={decrease}
          disabled={!canDecrease}
          style={[styles.stepButton, { borderRadius: rad.card }, !canDecrease && { opacity: stateLayer.disabledTextOpacity }]}
        >
          <Text style={styles.stepLabel}>−</Text>
        </Touchable>

        <Touchable
          onPress={increase}
          disabled={!canIncrease}
          style={[styles.stepButton, { borderRadius: rad.card }, !canIncrease && { opacity: stateLayer.disabledTextOpacity }]}
        >
          <Text style={styles.stepLabel}>+</Text>
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: veil.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gaugeDecor: {
    position: 'absolute',
    bottom: -16,
    right: -16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: onDarkAlpha.quiet,
  },
  bigValue: {
    ...typography.hero,
    color: onDarkAlpha.faint,
    marginBottom: spacing.roomy,
  },
  bigUnit: {
    ...typography.screenTitle,
    fontWeight: '400',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resetButton: {
    flex: 1,
    // A minimum, not a height: the label inside grows with the text size.
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    ...typography.rowSubtitle,
    fontWeight: '500',
    color: onDark.text,
  },
  stepButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: veil.cardInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    ...typography.sectionTitle,
    fontWeight: '400',
    color: onDarkAlpha.quieter,
  },
});
