import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { selectDownloadQuality, setDownloadQuality, AudioQuality } from '@/features/settings/playback/state';
import SettingsSelectCard from '../../components/SettingsSelectCard';
import { useTheme } from '@/features/theme/useTheme';
import { DOWNLOAD_QUALITY_OPTIONS } from '@/features/settings/constants';
import { spacing, typography } from '@/constants/design';

const DownloadQuality: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const downloadQuality = useSelector(selectDownloadQuality);

  const items = DOWNLOAD_QUALITY_OPTIONS.map(o => ({ key: o.key, label: t(o.labelKey) }));

  return (
    <>
      <SettingsSelectCard
        title={t('settings.library.downloadQuality.title')}
        items={items}
        isSelected={key => downloadQuality === key}
        onSelect={key => dispatch(setDownloadQuality(key as AudioQuality))}
      />
      <Text style={[styles.caption, { color: colors.subtext }]}>
        {t('settings.library.downloadQuality.caption')}
      </Text>
    </>
  );
};

export default DownloadQuality;

const styles = StyleSheet.create({
  caption: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
});
