import React from 'react';
import SettingsToggleGroup from '../components/SettingsToggleGroup';
import { ThemeColor } from './components/ThemeColor';
import { ThemePalette } from './components/ThemePalette';
import { BackgroundSelector } from './components/BackgroundSelector';
import { ThemeModeSelector } from './components/ThemeModeSelector';
import { PlayingBarActionSelector } from './components/PlayingBarActionSelector';
import { PlayerLayoutSelector } from './components/PlayerLayoutSelector';
import { GridColumns } from './components/GridColumns';
import { RadiusPresetSelector } from './components/RadiusPresetSelector';
import { ListDensitySelector } from './components/ListDensitySelector';
import { TextSizeSelector } from './components/TextSizeSelector';
import { useAppearanceToggles } from './useAppearanceToggles';

/** The appearance pages, in the order the index lists them. */
export const APPEARANCE_SECTIONS = ['colours', 'background', 'player', 'layout', 'dock'] as const;
export type AppearanceSectionId = (typeof APPEARANCE_SECTIONS)[number];

export function isAppearanceSection(value: unknown): value is AppearanceSectionId {
  return typeof value === 'string' && (APPEARANCE_SECTIONS as readonly string[]).includes(value);
}

/**
 * One appearance page's controls.
 *
 * Appearance was one page of some thirty controls, and each new option made
 * the others harder to find. It is split by what a person is trying to change:
 * the colours, what the screens are drawn over, the player, the shape and size
 * of things, and the dock and how the app feels to touch.
 */
export const AppearanceSection: React.FC<{ section: AppearanceSectionId }> = ({ section }) => {
  const toggles = useAppearanceToggles();

  switch (section) {
    case 'colours':
      return (
        <>
          <ThemeModeSelector />
          <ThemeColor />
          <SettingsToggleGroup items={toggles.accentItems} />
          <SettingsToggleGroup items={toggles.coverAccentItems} />
          <ThemePalette />
        </>
      );
    case 'background':
      return <BackgroundSelector />;
    case 'player':
      // Which controls the player draws is a question about what the app
      // looks like, so it is here rather than in Playback beside crossfade
      // and the equalizer. Playback is what you hear; Appearance is what you see.
      return (
        <>
          <PlayerLayoutSelector />
          <SettingsToggleGroup items={toggles.playerControlItems} />
          <SettingsToggleGroup items={toggles.qualityBadgeItems} />
          <PlayingBarActionSelector />
        </>
      );
    case 'layout':
      return (
        <>
          <TextSizeSelector />
          <ListDensitySelector />
          <RadiusPresetSelector />
          <GridColumns />
          <SettingsToggleGroup items={toggles.sourceHeaderItems} />
        </>
      );
    case 'dock':
      return <SettingsToggleGroup items={toggles.feelItems} />;
  }
};
