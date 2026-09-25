import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import {
  selectLoudnessNormalization,
  selectLoudnessPreampDb,
  setLoudnessNormalization,
  setLoudnessPreampDb,
} from '@/features/settings/playback/state';
import { spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { withAlpha } from '@/features/theme/coverAccent';
import SettingsCard from '../../components/SettingsCard';
import SettingsToggleRow from '../../components/SettingsToggleRow';

/**
 * Levelling tracks to one loudness, and the headroom it costs.
 *
 * ±15 dB, which is wider than any sane correction and deliberately so: the
 * preamp exists to give back the headroom normalising *takes*, and a library
 * mastered loud can need most of a 10 dB reduction returned before it sounds
 * as loud as it did unnormalised. The engine holds the total below clipping
 * using each track's own peak, so the top of this range is safe rather than
 * merely permitted.
 */
const PREAMP_LIMIT_DB = 15;

const Loudness: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const rad = useRadius();
  const enabled = useSelector(selectLoudnessNormalization);
  const preampDb = useSelector(selectLoudnessPreampDb);
  const themeColor = colors.themeColor;

  return (
    <>
      <SettingsCard>
        <SettingsToggleRow
          label={t('settings.player.loudness.label')}
          subtext={t('settings.player.loudness.subtext')}
          value={enabled}
          onValueChange={value => dispatch(setLoudnessNormalization(value))}
        />
      </SettingsCard>

      {/*
        Hidden while normalisation is off, for the same reason the crossfade
        segue toggle is: it refines a correction that is not being applied.
      */}
      {enabled && (
        <SettingsCard>
          <View style={styles.header}>
            <Text style={[styles.label, { color: colors.secondary }]}>
              {t('settings.player.loudness.preampLabel')}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: withAlpha(themeColor, 0.13), borderRadius: rad.card },
              ]}
            >
              <Text style={[styles.badgeText, { color: themeColor }]}>
                {`${preampDb > 0 ? '+' : ''}${preampDb} dB`}
              </Text>
            </View>
          </View>
          {/* The inset lives on a wrapper — see the note in `Crossfade`. */}
          <View style={styles.sliderRow}>
            <Slider
              style={styles.slider}
              minimumValue={-PREAMP_LIMIT_DB}
              maximumValue={PREAMP_LIMIT_DB}
              step={1}
              value={preampDb}
              onValueChange={value => dispatch(setLoudnessPreampDb(Math.round(value)))}
              minimumTrackTintColor={themeColor}
              maximumTrackTintColor={colors.border}
              thumbTintColor={themeColor}
            />
          </View>
          <Text style={[styles.subtext, { color: colors.subtext }]}>
            {t('settings.player.loudness.preampSubtext')}
          </Text>
        </SettingsCard>
      )}
    </>
  );
};

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
  badge: {
    paddingHorizontal: spacing.controlGap,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    ...typography.label,
  },
  sliderRow: {
    paddingHorizontal: spacing.lg,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  subtext: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});

export default Loudness;
