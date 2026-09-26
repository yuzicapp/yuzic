import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import IconActionButton from '@/components/IconActionButton';
import SectionHeader from '@/components/SectionHeader';
import { createSimilarityServiceQueueFillProvider } from '@/features/playback/queueProviders';
import { useApi } from '@/providers/registry/useApi';
import { useSimilarityService } from '@/providers/registry/similarityService';
import { useTracks } from '@/features/song/useTracks';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import { QueryKeys } from '@/state/query/queryKeys';
import { spacing } from '@/constants/design';
import seededShuffle from '@/features/playlist/seededShuffle';
import {
  LOCAL_RECOMMENDED_COUNT,
  pickFallbackLocalSongs,
  playlistArtistNames as computePlaylistArtistNames,
} from '@/features/playlist/recommendedSongs';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { LocalRow } from './Rows';

type Props = {
  playlist: Playlist;
  songs: Song[];
  localSeed: number;
  onRefresh: () => void;
};

/**
 * Local-library recommendations: the similarity service when one is connected,
 * falling back to a same-artist shuffle of the library — see
 * `recommendedSongs.ts` for the pure selection rules this builds from.
 */
export const LocalRecommendedSection: React.FC<Props> = ({ playlist, songs, localSeed, onRefresh }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const { tracks } = useTracks();
  const api = useApi();
  const isOffline = useIsOffline();
  const similarity = useSimilarityService();

  const playlistSongIds = useMemo(() => new Set(songs.map(s => s.localId)), [songs]);
  const playlistArtistNames = useMemo(() => computePlaylistArtistNames(songs), [songs]);

  // Same-artist shuffle from the local library — used whenever no similarity
  // service is connected, and as a safety net if its similarity call fails.
  const fallbackLocalSongs = useMemo<Song[]>(
    () => pickFallbackLocalSongs(tracks, playlistSongIds, playlistArtistNames, localSeed, LOCAL_RECOMMENDED_COUNT),
    [tracks, playlistSongIds, playlistArtistNames, localSeed]
  );

  // Reseed a handful of playlist tracks each refresh so acoustic similarity
  // results vary too, matching the fallback's shuffled feel.
  const similaritySeeds = useMemo(
    () => seededShuffle(songs, localSeed).slice(0, 5),
    [songs, localSeed]
  );

  const similarityQuery = useQuery({
    queryKey: [
      QueryKeys.RecommendedLocalSongs,
      'similarityService',
      playlist.nativeId,
      similaritySeeds.map(s => s.nativeId).join(','),
    ],
    queryFn: () => createSimilarityServiceQueueFillProvider(similarity!, api).fetchExtension({
      recentSongs: similaritySeeds,
      excludeIds: playlistSongIds,
      count: LOCAL_RECOMMENDED_COUNT,
    }),
    enabled: similarity !== null && !isOffline && similaritySeeds.length > 0,
    staleTime: 1000 * 60 * 30,
    networkMode: 'online',
  });

  const localSongs: Song[] = similarityQuery.data?.length ? similarityQuery.data : fallbackLocalSongs;

  if (localSongs.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('playlist.recommended.local')}
        action={
          <IconActionButton
            icon={<RefreshCw size={icons.row} color={colors.subtext} />}
            onPress={onRefresh}
            accessibilityLabel={t('playlist.recommended.refresh')}
            size="compact"
          />
        }
      />

      {localSongs.map(song => (
        <LocalRow key={song.localId} song={song} playlistId={playlist.nativeId} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingTop: spacing.xl,
  },
});
