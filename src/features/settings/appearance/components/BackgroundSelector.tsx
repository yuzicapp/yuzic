import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Ban, Disc3, ImageIcon } from 'lucide-react-native';

import { iconSize, spacing, typography } from '@/constants/design';
import { notify } from '@/components/toast';
import { editTheme, selectActiveTheme } from '@/features/settings/appearance/state';
import { pickBackgroundImage, removeBackgroundImage } from '@/features/theme/backgroundImage';
import type { ScreenBackgroundSource } from '@/features/theme/theme';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from '../../components/SettingsCard';
import SettingsDivider from '../../components/SettingsDivider';
import SettingsIconSelectCard from '../../components/SettingsIconSelectCard';
import SettingsRow from '../../components/SettingsRow';
import SettingsToggleRow from '../../components/SettingsToggleRow';

type Choice = ScreenBackgroundSource['kind'];

const OPTIONS: { id: Choice; icon: React.ReactElement<{ color?: string }> }[] = [
  { id: 'none', icon: <Ban size={iconSize.row} /> },
  { id: 'image', icon: <ImageIcon size={iconSize.row} /> },
  { id: 'cover', icon: <Disc3 size={iconSize.row} /> },
];

/**
 * What the tab screens are drawn over: their plain colour, a photo, or the
 * cover of what is playing; whether that is Home alone or every tab; and how
 * blurred and how veiled the image is.
 *
 * Choosing a photo asks for one straight away, since a photo background with
 * no photo is not a state worth being in. A replaced photo's copy is deleted.
 */
export const BackgroundSelector: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const surface = useSelector(selectActiveTheme).surface;
  const background = surface.background;

  const setBackground = (next: ScreenBackgroundSource) => {
    if (background.kind === 'image' && (next.kind !== 'image' || next.uri !== background.uri)) {
      void removeBackgroundImage(background.uri);
    }
    dispatch(editTheme({ surface: { background: next } }));
  };

  const choosePhoto = async () => {
    try {
      const uri = await pickBackgroundImage();
      if (uri) setBackground({ kind: 'image', uri });
    } catch {
      notify.error(t('settings.appearance.background.pickFailed'));
    }
  };

  const onSelect = (id: string) => {
    if (id === 'image') {
      if (background.kind !== 'image') void choosePhoto();
      return;
    }
    setBackground({ kind: id as 'none' | 'cover' });
  };

  return (
    <>
      <SettingsIconSelectCard
        title={t('settings.appearance.background.title')}
        subtitle={t('settings.appearance.background.subtitle')}
        items={OPTIONS.map(option => ({
          id: option.id,
          icon: option.icon,
          label: t(`settings.appearance.background.${option.id}`),
        }))}
        selected={background.kind}
        onSelect={onSelect}
      />
      {background.kind !== 'none' && (
        <SettingsCard>
          {background.kind === 'image' && (
            <>
              <SettingsRow label={t('settings.appearance.background.changePhoto')} onPress={() => void choosePhoto()} />
              <SettingsDivider />
            </>
          )}
          <SettingsToggleRow
            label={t('settings.appearance.background.everyTab')}
            subtext={t('settings.appearance.background.everyTabSubtext')}
            value={surface.backgroundScope === 'tabs'}
            onValueChange={v => dispatch(editTheme({ surface: { backgroundScope: v ? 'tabs' : 'home' } }))}
          />
          <SettingsDivider />
          <SliderRow
            label={t('settings.appearance.background.blur')}
            value={surface.backgroundBlur}
            maximum={60}
            step={1}
            color={colors.themeColor}
            onDone={value => dispatch(editTheme({ surface: { backgroundBlur: value } }))}
          />
          <SettingsDivider />
          <SliderRow
            label={t('settings.appearance.background.dim')}
            value={surface.backgroundDim}
            maximum={0.95}
            step={0.05}
            color={colors.themeColor}
            onDone={value => dispatch(editTheme({ surface: { backgroundDim: value } }))}
          />
        </SettingsCard>
      )}
    </>
  );
};

type SliderRowProps = {
  label: string;
  value: number;
  maximum: number;
  step: number;
  color: string;
  onDone: (value: number) => void;
};

/** A labelled slider that writes on release, so a drag is one edit rather than sixty. */
const SliderRow: React.FC<SliderRowProps> = ({ label, value, maximum, step, color, onDone }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sliderRow}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <Slider
        accessibilityLabel={label}
        minimumValue={0}
        maximumValue={maximum}
        step={step}
        value={value}
        onSlidingComplete={onDone}
        minimumTrackTintColor={color}
        maximumTrackTintColor={colors.border}
        thumbTintColor={color}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sliderRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  label: {
    ...typography.compactRowTitle,
  },
});
