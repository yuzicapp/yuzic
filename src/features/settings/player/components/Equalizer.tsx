import { onDark, spacing, stateLayer, typography } from '@/constants/design';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import { selectEqualizerGains, setEqualizerGains } from '@/features/settings/playback/state';
import { useRadius } from '@/features/theme/useRadius';
import SettingsCard from '../../components/SettingsCard';
import { withAlpha } from '@/features/theme/coverAccent';
import {
  EQ_FREQUENCIES,
  EQ_GAIN_LIMIT_DB,
  EQ_PRESETS,
  matchPreset,
  presetToBands,
} from '@/features/player/audioSettings';

/** 32 → "32", 16000 → "16k". Axis labels, not prose. */
function labelFor(frequencyHz: number): string {
  return frequencyHz >= 1000 ? `${frequencyHz / 1000}k` : `${frequencyHz}`;
}

const Equalizer: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const rad = useRadius();
  const gains = useSelector(selectEqualizerGains);
  const themeColor = colors.themeColor;

  const activePreset = useMemo(() => matchPreset(presetToBands(gains)), [gains]);
  const isFlat = useMemo(() => gains.every(gain => gain === 0), [gains]);

  const setBand = useCallback(
    (index: number, gainDb: number) => {
      const next = [...gains];
      next[index] = Math.round(gainDb);
      dispatch(setEqualizerGains(next));
    },
    [gains, dispatch],
  );

  return (
    <SettingsCard>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.secondary }]}>
          {t('settings.player.equalizer.title')}
        </Text>
        {!isFlat && (
          <Pressable
            onPress={() => dispatch(setEqualizerGains(EQ_PRESETS[0].gains))}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.equalizer.reset')}
            hitSlop={spacing.sm}
          >
            <Text style={[styles.reset, { color: themeColor }]}>
              {t('settings.player.equalizer.reset')}
            </Text>
          </Pressable>
        )}
      </View>

      {/*
        Horizontally scrollable rather than squeezed to fit. Ten bands across a
        phone leaves each slider too narrow to grab, and a control you cannot
        reliably hit is worse than one you have to scroll to.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
      >
        {EQ_PRESETS.map(preset => {
          const selected = activePreset === preset.id;
          return (
            <Pressable
              key={preset.id}
              onPress={() => dispatch(setEqualizerGains(preset.gains))}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('a11y.equalizer.preset', { name: t(preset.labelKey) })}
              style={[
                styles.preset,
                {
                  borderRadius: rad.card,
                  backgroundColor: selected ? themeColor : withAlpha(colors.border, 0.33),
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: selected ? onDark.text : colors.secondary },
                ]}
              >
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bands}
      >
        {EQ_FREQUENCIES.map((frequencyHz, index) => {
          const gain = gains[index] ?? 0;
          return (
            <View key={frequencyHz} style={styles.band}>
              <Text style={[styles.gain, { color: gain === 0 ? colors.subtext : themeColor }]}>
                {gain > 0 ? `+${gain}` : gain}
              </Text>
              {/*
                A vertical slider is what an equalizer looks like everywhere
                else, and `@react-native-community/slider` has no vertical
                mode — so it is rotated. `height` and `width` are swapped in
                the style because the rotation happens after layout.
              */}
              <View style={styles.sliderWell}>
                {/*
                  The track is drawn here rather than by the Slider, because
                  this control is bipolar and the Slider only fills from one
                  end. Filling from minimum would leave every band half-filled
                  at 0 dB — the state a user sees most — which reads as "half
                  on" rather than "neutral". Filling from the centre detent
                  outward makes flat read as empty, and makes a boost and a cut
                  distinguishable by direction rather than by length.

                  The crossfade slider above still fills from its low end, and
                  that is not an inconsistency: it runs 0..12 with no
                  meaningful centre.
                */}
                <View style={[styles.trackBase, { backgroundColor: colors.border }]} />
                <View style={[styles.detent, { backgroundColor: colors.subtext }]} />
                {gain !== 0 && (
                  <View
                    style={[
                      styles.trackFill,
                      {
                        backgroundColor: themeColor,
                        height: (Math.abs(gain) / EQ_GAIN_LIMIT_DB) * (SLIDER_LENGTH / 2),
                        bottom:
                          gain > 0
                            ? SLIDER_LENGTH / 2
                            : SLIDER_LENGTH / 2 -
                              (Math.abs(gain) / EQ_GAIN_LIMIT_DB) * (SLIDER_LENGTH / 2),
                      },
                    ]}
                  />
                )}
                <Slider
                  style={styles.slider}
                  minimumValue={-EQ_GAIN_LIMIT_DB}
                  maximumValue={EQ_GAIN_LIMIT_DB}
                  step={1}
                  value={gain}
                  onValueChange={value => setBand(index, value)}
                  // Both transparent: the fill above is the visible track.
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor={themeColor}
                  accessibilityLabel={t('a11y.equalizer.band', {
                    frequency: labelFor(frequencyHz),
                  })}
                  accessibilityValue={{ text: t('a11y.equalizer.decibels', { gain }) }}
                />
              </View>
              <Text style={[styles.frequency, { color: colors.subtext }]}>
                {labelFor(frequencyHz)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <Text style={[styles.subtext, { color: colors.subtext }]}>
        {isFlat
          ? t('settings.player.equalizer.flatSubtext')
          : t('settings.player.equalizer.gainSubtext', { limit: EQ_GAIN_LIMIT_DB })}
      </Text>
    </SettingsCard>
  );
};

const SLIDER_LENGTH = 120;
const TRACK_WIDTH = 4;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  label: {
    ...typography.body,
  },
  reset: {
    ...typography.label,
  },
  presets: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.controlGap,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  presetText: {
    ...typography.label,
  },
  bands: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  band: {
    alignItems: 'center',
    width: 44,
  },
  gain: {
    ...typography.caption,
    marginBottom: spacing.xxs,
  },
  // The rotated slider is laid out as a wide, short control and then turned,
  // so the well reserves the space the rotation will occupy.
  sliderWell: {
    height: SLIDER_LENGTH,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The full-length groove, behind everything. */
  trackBase: {
    position: 'absolute',
    width: TRACK_WIDTH,
    height: SLIDER_LENGTH,
    borderRadius: TRACK_WIDTH / 2,
  },
  /** The 0 dB mark, so neutral is findable without reading the number. */
  detent: {
    position: 'absolute',
    width: 12,
    height: 1,
    opacity: stateLayer.mutedOpacity,
  },
  /** Centre outward: up for a boost, down for a cut. */
  trackFill: {
    position: 'absolute',
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
  },
  slider: {
    width: SLIDER_LENGTH,
    height: 40,
    transform: [{ rotate: '-90deg' }],
  },
  frequency: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  subtext: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});

export default Equalizer;
