import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Slider from '@react-native-community/slider';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import { selectCrossfadeSeconds, selectCrossfadeAlways, setCrossfadeSeconds, setCrossfadeAlways } from '@/features/settings/playback/state';
import { spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import SettingsCard from '../../components/SettingsCard';
import SettingsToggleRow from '../../components/SettingsToggleRow';
import { withAlpha } from '@/features/theme/coverAccent';

/**
 * Twelve seconds, because past that the overlap stops being a transition and
 * becomes two songs playing at once. Radio stations top out around eight.
 */
const MAX_SECONDS = 12;

const Crossfade: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const rad = useRadius();
  const seconds = useSelector(selectCrossfadeSeconds);
  const always = useSelector(selectCrossfadeAlways);
  const themeColor = colors.themeColor;

  const off = seconds <= 0;

  return (
    <>
      <SettingsCard>
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.secondary }]}>
            {t('settings.player.crossfade.label')}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: withAlpha(themeColor, 0.13), borderRadius: rad.card },
            ]}
          >
            <Text style={[styles.badgeText, { color: themeColor }]}>
              {off ? t('settings.player.crossfade.off') : `${seconds}s`}
            </Text>
          </View>
        </View>
        {/*
          The inset lives on a wrapper rather than on the Slider itself.
          `width: '100%'` plus the control's own `paddingHorizontal` does not
          inset it symmetrically — the track keeps its full width and shifts,
          so it runs past the right edge of the card.
        */}
        <View style={styles.sliderRow}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={MAX_SECONDS}
          step={1}
          value={seconds}
          onValueChange={value => dispatch(setCrossfadeSeconds(Math.round(value)))}
          minimumTrackTintColor={themeColor}
          maximumTrackTintColor={colors.border}
          thumbTintColor={themeColor}
        />
        </View>
        <Text style={[styles.subtext, { color: colors.subtext }]}>
          {off
            ? t('settings.player.crossfade.offSubtext')
            : t('settings.player.crossfade.onSubtext', { seconds })}
        </Text>
      </SettingsCard>

      {/*
        Hidden while crossfade is off, rather than shown disabled. It is a
        refinement of a fade that is not happening, and a greyed-out control
        invites the question of why it is there at all.
      */}
      {!off && (
        <SettingsCard>
          <SettingsToggleRow
            label={t('settings.player.crossfade.seguesLabel')}
            subtext={t('settings.player.crossfade.seguesSubtext')}
            value={always}
            onValueChange={value => dispatch(setCrossfadeAlways(value))}
          />
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

export default Crossfade;
