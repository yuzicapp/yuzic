import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import SettingsScreen from '../components/SettingsScreen';
import { AppearanceSection, isAppearanceSection } from './AppearanceSection';

/** One appearance page, named by the `section` it was opened with. */
const AppearanceSectionScreen: React.FC = () => {
  const { t } = useTranslation();
  const { section } = useLocalSearchParams<{ section?: string }>();
  // An unknown section, from a stale link, opens the colours rather than a blank page.
  const shown = isAppearanceSection(section) ? section : 'colours';
  return (
    <SettingsScreen title={t(`settings.appearance.sections.${shown}`)}>
      <AppearanceSection section={shown} />
    </SettingsScreen>
  );
};

export default AppearanceSectionScreen;
