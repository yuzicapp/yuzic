import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, RectangleHorizontal } from 'lucide-react-native';

import { iconSize } from '@/constants/design';
import { editTheme, selectActiveTheme } from '@/features/settings/appearance/state';
import type { Theme } from '@/features/theme/theme';
import SettingsIconSelectCard from '../../components/SettingsIconSelectCard';

type Layout = Theme['components']['playerLayout'];

const OPTIONS: { id: Layout; icon: React.ReactElement<{ color?: string }> }[] = [
  { id: 'artwork', icon: <Maximize2 size={iconSize.row} /> },
  { id: 'fullWidth', icon: <RectangleHorizontal size={iconSize.row} /> },
  { id: 'compact', icon: <Minimize2 size={iconSize.row} /> },
];

/** The player with its cover at full width, or smaller so what is below it starts sooner. */
export const PlayerLayoutSelector: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const selected = useSelector(selectActiveTheme).components.playerLayout;

  return (
    <SettingsIconSelectCard
      title={t('settings.appearance.playerLayout.title')}
      subtitle={t('settings.appearance.playerLayout.subtitle')}
      items={OPTIONS.map(option => ({
        id: option.id,
        icon: option.icon,
        label: t(`settings.appearance.playerLayout.${option.id}`),
      }))}
      selected={selected}
      onSelect={id => dispatch(editTheme({ components: { playerLayout: id as Layout } }))}
      showLabels
    />
  );
};
