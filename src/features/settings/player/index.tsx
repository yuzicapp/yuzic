import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { notify } from '@/components/toast';
import { getBackend } from '@/features/player/activeBackend';
import { useDispatch, useSelector } from 'react-redux';
import { useApi } from '@/providers/registry/useApi';
import SettingsScreen from '../components/SettingsScreen';
import SettingsToggleGroup from '../components/SettingsToggleGroup';
import SettingsCard from '../components/SettingsCard';
import SettingsCardHeader from '../components/SettingsCardHeader';
import SettingsRow from '../components/SettingsRow';
import StreamingQuality from './components/StreamingQuality';
import Crossfade from './components/Crossfade';
import Loudness from './components/Loudness';
import { selectPreferredCodec, selectAutoplayEnabled, selectResumeLongTracksEnabled, setPreferredCodec, setAutoplayEnabled, setResumeLongTracksEnabled } from '@/features/settings/playback/state';
import { useSimilarityService } from '@/providers/registry/similarityService';

const PlayerSettings: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const api = useApi();
  const preferredCodec = useSelector(selectPreferredCodec);
  const autoplayEnabled = useSelector(selectAutoplayEnabled);
  const resumeLongTracks = useSelector(selectResumeLongTracksEnabled);
  const hasSimilarityService = useSimilarityService() !== null;
  // Presence, not provider: a server whose adapter declares Opus gets the
  // switch, whichever server it is.
  const supportsOpus = api.songs.streamableCodecs.includes('opus');

  const toggleOpus = useCallback((v: boolean) => { dispatch(setPreferredCodec(v ? 'opus' : 'mp3')); }, [dispatch]);
  const opusItems = useMemo(() => [{
    label: t('settings.player.opusCodec'),
    subtext: t('settings.player.opusCodecSubtext'),
    value: preferredCodec === 'opus',
    onValueChange: toggleOpus,
  }], [t, preferredCodec, toggleOpus]);

  const autoplayItems = useMemo(() => [
    {
      label: t('settings.player.autoplay'),
      subtext: hasSimilarityService
        ? t('settings.player.autoplaySubtextSimilarity')
        : t('settings.player.autoplaySubtextNative'),
      value: autoplayEnabled,
      onValueChange: (v: boolean) => dispatch(setAutoplayEnabled(v)),
    },
    // Long-form resume (audiobooks, DJ sets, podcast episodes). Off means
    // a paused 90-min mix restarts from the top next time. Podcast episodes
    // are always bookmarkable, so this toggle governs songs ≥ 20 minutes.
    {
      label: t('settings.player.resumeLongTracks'),
      subtext: t('settings.player.resumeLongTracksSubtext'),
      value: resumeLongTracks,
      onValueChange: (v: boolean) => dispatch(setResumeLongTracksEnabled(v)),
    },
  ], [t, hasSimilarityService, autoplayEnabled, resumeLongTracks, dispatch]);

  // The stream cache is the player's own, and separate from downloads: it
  // fills itself as you listen so a re-listen doesn't refetch, and evicts
  // least-recently-used past its cap. There was no way to see it or empty it,
  // which matters on a device that is short of room — the Downloads screen
  // reports its size and this did not exist at all.
  const clearStreamCache = useCallback(() => {
    Alert.alert(
      t('settings.player.clearCacheTitle'),
      t('settings.player.clearCacheBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.player.clearCacheConfirm'),
          style: 'destructive',
          onPress: () => {
            try {
              // Through the backend, so this empties whichever player is
              // actually holding the audio. Called on TrackPlayer directly it
              // would clear rntp's cache while the engine kept its own.
              getBackend().clearCache();
              notify.success(t('settings.player.clearCacheDone'));
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
        },
      ]
    );
  }, [t]);

  return (
    <SettingsScreen title={t('settings.player.title')}>
      {/*
        Audio first, then behaviour, then storage. Crossfade and the equalizer
        used to sit fifth, below four "show this control in the player"
        toggles — which are display settings and now live in Appearance, with
        the rest of what the app looks like.
      */}
      <StreamingQuality />
      {supportsOpus && <SettingsToggleGroup items={opusItems} />}

      <SettingsCardHeader subtle title={t('settings.player.audio')} />
      <Crossfade />
      <Loudness />
      <SettingsCard>
        {/*
          A row rather than the equalizer itself: inline, its rotated band
          sliders claimed the vertical drag that was meant to scroll the page,
          so scrolling past it changed the user's sound. See
          `screens/settings/equalizer`.
        */}
        <SettingsRow
          label={t('settings.player.equalizer.title')}
          onPress={() => router.push('/settings/equalizerView')}
        />
      </SettingsCard>

      <SettingsToggleGroup items={autoplayItems} />

      <SettingsCardHeader subtle title={t('settings.player.cacheTitle')} />
      <SettingsCard>
        <SettingsRow
          label={t('settings.player.clearCache')}
          onPress={clearStreamCache}
        />
      </SettingsCard>
    </SettingsScreen>
  );
};

export default PlayerSettings;
