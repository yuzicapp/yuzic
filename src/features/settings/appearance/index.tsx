import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import SettingsScreen from '../components/SettingsScreen';
import SettingsCardHeader from '../components/SettingsCardHeader';
import SettingsToggleGroup from '../components/SettingsToggleGroup';
import { ThemeColor } from './components/ThemeColor';
import { ThemePalette } from './components/ThemePalette';
import { BackgroundSelector } from './components/BackgroundSelector';
import { ThemeModeSelector } from './components/ThemeModeSelector';
import { PlayingBarActionSelector } from './components/PlayingBarActionSelector';
import { PlayerLayoutSelector } from './components/PlayerLayoutSelector';
import { LanguageSelector } from './components/LanguageSelector';
import { GridColumns } from './components/GridColumns';
import { RadiusPresetSelector } from './components/RadiusPresetSelector';
import { ListDensitySelector } from './components/ListDensitySelector';
import { TextSizeSelector } from './components/TextSizeSelector';
import { selectShowQualityBadge, selectShowSourceHeaders, selectHapticsEnabled, selectTranslucentDock, selectRespectReducedMotion, selectCoverAccentEnabled, setShowQualityBadge, setShowSourceHeaders, setHapticsEnabled, setTranslucentDock, setRespectReducedMotion, setCoverAccentEnabled, selectActiveTheme, editTheme } from '@/features/settings/appearance/state';
import { selectShowPlaybackSpeed, selectShowJumpButtons, selectShowVolumeSlider, selectShowRating, setShowPlaybackSpeed, setShowJumpButtons, setShowVolumeSlider, setShowRating } from '@/features/settings/playback/state';
import { useRatingsAvailable } from '@/features/ratings/useRatingsAvailable';

const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const showQualityBadge = useSelector(selectShowQualityBadge);
  const showSourceHeaders = useSelector(selectShowSourceHeaders);
  const hapticsEnabled = useSelector(selectHapticsEnabled);
  const translucentDock = useSelector(selectTranslucentDock);
  const respectReducedMotion = useSelector(selectRespectReducedMotion);
  const coverAccentEnabled = useSelector(selectCoverAccentEnabled);
  const activeTheme = useSelector(selectActiveTheme);
  const { dockShape, tabLabels } = activeTheme.components;
  const accentFromCover = activeTheme.accentFromCover;
  const showPlaybackSpeed = useSelector(selectShowPlaybackSpeed);
  const showJumpButtons = useSelector(selectShowJumpButtons);
  const showVolumeSlider = useSelector(selectShowVolumeSlider);
  const showRating = useSelector(selectShowRating);
  const ratingsAvailable = useRatingsAvailable();

  const toggleQualityBadge = useCallback((v: boolean) => { dispatch(setShowQualityBadge(v)); }, [dispatch]);
  const toggleSourceHeaders = useCallback((v: boolean) => { dispatch(setShowSourceHeaders(v)); }, [dispatch]);
  const toggleHaptics = useCallback((v: boolean) => { dispatch(setHapticsEnabled(v)); }, [dispatch]);
  const toggleReducedMotion = useCallback((v: boolean) => { dispatch(setRespectReducedMotion(v)); }, [dispatch]);
  const toggleCoverAccent = useCallback((v: boolean) => { dispatch(setCoverAccentEnabled(v)); }, [dispatch]);
  const toggleTranslucentDock = useCallback((v: boolean) => { dispatch(setTranslucentDock(v)); }, [dispatch]);
  const toggleAccentFromCover = useCallback((v: boolean) => {
    dispatch(editTheme({ accentFromCover: v }));
  }, [dispatch]);
  const toggleFloatingDock = useCallback((v: boolean) => {
    dispatch(editTheme({ components: { dockShape: v ? 'floating' : 'edge' } }));
  }, [dispatch]);
  const toggleTabLabels = useCallback((v: boolean) => {
    dispatch(editTheme({ components: { tabLabels: v } }));
  }, [dispatch]);

  const togglePlaybackSpeed = useCallback((v: boolean) => { dispatch(setShowPlaybackSpeed(v)); }, [dispatch]);
  const toggleJumpButtons = useCallback((v: boolean) => { dispatch(setShowJumpButtons(v)); }, [dispatch]);
  const toggleVolumeSlider = useCallback((v: boolean) => { dispatch(setShowVolumeSlider(v)); }, [dispatch]);
  const toggleRating = useCallback((v: boolean) => { dispatch(setShowRating(v)); }, [dispatch]);

  // Which controls the player screen draws. The strings still live under
  // `settings.player.*` because that is where they were written and a key is
  // not worth a four-locale rename; the setting itself belongs here.
  const playerControlItems = useMemo(() => [
    {
      label: t('settings.player.showPlaybackSpeed'),
      subtext: t('settings.player.showPlaybackSpeedSubtext'),
      value: showPlaybackSpeed,
      onValueChange: togglePlaybackSpeed,
    },
    {
      label: t('settings.player.showJumpButtons'),
      subtext: t('settings.player.showJumpButtonsSubtext'),
      value: showJumpButtons,
      onValueChange: toggleJumpButtons,
    },
    {
      label: t('settings.player.showVolumeSlider'),
      subtext: t('settings.player.showVolumeSliderSubtext'),
      value: showVolumeSlider,
      onValueChange: toggleVolumeSlider,
    },
    // Absent rather than disabled where the server has no ratings: a switch
    // that cannot change anything is a question the screen should not ask.
    ...(ratingsAvailable ? [{
      label: t('settings.player.showRating'),
      subtext: t('settings.player.showRatingSubtext'),
      value: showRating,
      onValueChange: toggleRating,
    }] : []),
  ], [
    t, showPlaybackSpeed, showJumpButtons, showVolumeSlider, showRating, ratingsAvailable,
    togglePlaybackSpeed, toggleJumpButtons, toggleVolumeSlider, toggleRating,
  ]);

  const feelItems = useMemo(() => [
    {
      label: t('settings.appearance.translucentDock'),
      subtext: t('settings.appearance.translucentDockSubtext'),
      value: translucentDock,
      onValueChange: toggleTranslucentDock,
    },
    {
      label: t('settings.appearance.floatingDock'),
      subtext: t('settings.appearance.floatingDockSubtext'),
      value: dockShape === 'floating',
      onValueChange: toggleFloatingDock,
    },
    {
      label: t('settings.appearance.tabLabels'),
      subtext: t('settings.appearance.tabLabelsSubtext'),
      value: tabLabels,
      onValueChange: toggleTabLabels,
    },
    {
      label: t('settings.appearance.haptics'),
      subtext: t('settings.appearance.hapticsSubtext'),
      value: hapticsEnabled,
      onValueChange: toggleHaptics,
    },
    {
      label: t('settings.appearance.respectReducedMotion'),
      subtext: t('settings.appearance.respectReducedMotionSubtext'),
      value: respectReducedMotion,
      onValueChange: toggleReducedMotion,
    },
  ], [t, translucentDock, dockShape, tabLabels, hapticsEnabled, respectReducedMotion, toggleTranslucentDock, toggleFloatingDock, toggleTabLabels, toggleHaptics, toggleReducedMotion]);

  const accentItems = useMemo(() => [{
    label: t('settings.appearance.accentFromCover'),
    subtext: t('settings.appearance.accentFromCoverSubtext'),
    value: accentFromCover,
    onValueChange: toggleAccentFromCover,
  }], [t, accentFromCover, toggleAccentFromCover]);

  const qualityBadgeItems = useMemo(() => [{
    label: t('settings.appearance.showQualityBadge'),
    subtext: t('settings.appearance.showQualityBadgeSubtext'),
    value: showQualityBadge,
    onValueChange: toggleQualityBadge,
  }], [t, showQualityBadge, toggleQualityBadge]);

  const coverAccentItems = useMemo(() => [{
    label: t('settings.appearance.coverAccent'),
    subtext: t('settings.appearance.coverAccentSubtext'),
    value: coverAccentEnabled,
    onValueChange: toggleCoverAccent,
  }], [t, coverAccentEnabled, toggleCoverAccent]);

  const sourceHeaderItems = useMemo(() => [{
    label: t('settings.appearance.showSourceHeaders'),
    subtext: t('settings.appearance.showSourceHeadersSubtext'),
    value: showSourceHeaders,
    onValueChange: toggleSourceHeaders,
  }], [t, showSourceHeaders, toggleSourceHeaders]);

  return (
    <SettingsScreen title={t('settings.appearance.title')}>
      <LanguageSelector />
      <ThemeModeSelector />
      <ThemeColor />
      <SettingsToggleGroup items={accentItems} />
      <ThemePalette />
      <BackgroundSelector />
      {/*
        "Playing" is which controls the player screen draws, which is a
        question about what the app looks like — so it belongs here, next to
        the playing-bar action, rather than in Playback beside crossfade and
        the equalizer. Playback is what you hear; Appearance is what you see.
      */}
      <SettingsCardHeader subtle title={t('settings.appearance.playing')} />
      <SettingsToggleGroup items={qualityBadgeItems} />
      <SettingsToggleGroup items={playerControlItems} />
      <PlayingBarActionSelector />
      <PlayerLayoutSelector />
      <SettingsCardHeader subtle title={t('settings.appearance.display')} />
      <SettingsToggleGroup items={sourceHeaderItems} />
      <SettingsToggleGroup items={coverAccentItems} />
      <GridColumns />
      <RadiusPresetSelector />
      <ListDensitySelector />
      <TextSizeSelector />
      <SettingsCardHeader subtle title={t('settings.appearance.feel')} />
      <SettingsToggleGroup items={feelItems} />
    </SettingsScreen>
  );
};

export default AppearanceSettings;
