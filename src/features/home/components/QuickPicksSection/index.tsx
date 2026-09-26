import React, { useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { Ellipsis } from 'lucide-react-native';
import { notify } from '@/components/toast';
import { useSelector } from 'react-redux';
import { selectHomeShelfItemCount } from '@/features/settings/home/state';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext';
import IconActionButton from '@/components/IconActionButton';
import MediaListRow from '@/components/MediaListRow';
import {
  selectSongPlayCounts,
  selectSongLastPlayedAt,
} from '@/state/redux/selectors/statsSelectors';
import { useSongsById } from '@/features/song/useSongsById';
import { seededShuffle } from '@/features/home/hooks/useDailyLayout';
import { useStableList } from '@/features/home/hooks/useStableList';
import type { Song } from '@/domain/entities/Song';
import {
  QUICK_PICKS_PAGE_SIZE,
  QUICK_PICKS_CANDIDATE_POOL,
  QUICK_PICKS_DECAY_MS,
  QUICK_PICKS_PEEK,
  SECTION_H_PADDING,
} from '@/features/home/constants';
import { contentWidth, spacing, typography } from '@/constants/design';

function useQuickPicks(refreshKey: number, itemCount: number): Song[] {
  const songsById = useSongsById();
  const playCounts = useSelector(selectSongPlayCounts);
  const lastPlayedAt = useSelector(selectSongLastPlayedAt);

  return useMemo(() => {
    const now = Date.now();
    const scored: { song: Song; score: number }[] = [];

    // Only iterate songs that actually have stats — avoids scanning the full 9000-song
    // library on every play count change (O(played) instead of O(library)).
    const idsWithStats = new Set([...Object.keys(playCounts), ...Object.keys(lastPlayedAt)]);

    for (const id of idsWithStats) {
      const song = songsById.get(id);
      if (!song) continue;
      const count = playCounts[id] ?? 0;
      const ts = lastPlayedAt[id] ?? 0;
      const recency = ts > 0 ? Math.exp(-(now - ts) / QUICK_PICKS_DECAY_MS) : 0;
      const freq = count > 0 ? Math.min(1, Math.log(count + 1) / Math.log(50)) : 0;
      scored.push({ song, score: recency * 0.8 + freq * 0.2 });
    }

    scored.sort((a, b) => b.score - a.score);
    const pool = scored.slice(0, QUICK_PICKS_CANDIDATE_POOL).map(s => s.song);
    if (refreshKey === 0) return pool.slice(0, itemCount);
    return seededShuffle(pool, (Math.imul(refreshKey, 1664525) + 1013904223) | 0).slice(0, itemCount);
  }, [songsById, playCounts, lastPlayedAt, refreshKey, itemCount]);
}

type Props = { refreshKey?: number };

export default function QuickPicksSection({ refreshKey = 0 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const { playSong } = usePlayingActions();
  const { resolvePlayableSong } = usePlayableSongResolver();
  const itemCount = useSelector(selectHomeShelfItemCount);
  // Stable while the picks are unchanged; see `useStableList`.
  const picks = useStableList(useQuickPicks(refreshKey, itemCount));
  const { width: screenWidth } = useWindowDimensions();
  // A page is a column of four track rows, so it is capped like any other
  // column of rows rather than following the window: a 1366pt page put the
  // title and the ⋯ a foot apart with nothing in between. The peek is what
  // says there is another page, and it only has a job while the page is the
  // width of the window.
  const pageWidth = Math.min(screenWidth - QUICK_PICKS_PEEK, contentWidth.readable);
  const { openSongOptions } = useSongActionSheets();

  const inFlightRef = useRef<string | null>(null);

  // Resolved by the origin's own id: the resolver looks the track up fresh
  // rather than trusting whatever fields this screen happens to hold.
  const handlePress = async (song: Song) => {
    if (inFlightRef.current === song.nativeId) return;
    inFlightRef.current = song.nativeId;
    try {
      const playable = await resolvePlayableSong(song.nativeId);
      if (playable) await playSong(playable.song);
      else notify.error(t('common.playbackError'));
    } finally {
      inFlightRef.current = null;
    }
  };

  const handleOptions = async (song: Song) => {
    const resolved = await resolvePlayableSong(song.nativeId, { allowNetwork: false });
    openSongOptions(resolved?.song ?? song);
  };

  const pages = useMemo(() => {
    const result: Song[][] = [];
    for (let i = 0; i < picks.length; i += QUICK_PICKS_PAGE_SIZE) {
      result.push(picks.slice(i, i + QUICK_PICKS_PAGE_SIZE));
    }
    return result;
  }, [picks]);

  // Hide the whole section until there's something to show, rather than leading
  // Home with an empty placeholder. It reappears once the user has play history.
  if (pages.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('explore.sections.quickPicks')}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageWidth}
        snapToAlignment="start"
      >
        {pages.map((page, pageIdx) => (
          <View key={pageIdx} style={[styles.page, { width: pageWidth }]}>
            {page.map(song => (
              <MediaListRow
                key={song.localId}
                title={song.title}
                subtitle={song.artist.name}
                cover={song.cover}
                onPress={() => { void handlePress(song); }}
                variant="compact"
                style={styles.rowWrapper}
                rowStyle={styles.row}
                trailing={
                  <IconActionButton
                    icon={<Ellipsis size={icons.row} color={colors.secondary} />}
                    onPress={() => { void handleOptions(song); }}
                    accessibilityLabel={t('a11y.rows.options', { title: song.title })}
                    size="compact"
                  />
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    marginBottom: spacing.sm,
    paddingHorizontal: SECTION_H_PADDING,
  },
  page: {
    gap: spacing.xxs,
  },
  rowWrapper: {
    paddingHorizontal: 0,
  },
  // Horizontal only. `rowStyle` is spread after the density padding in
  // MediaListRow, so a `paddingVertical` here silently replaced it and Quick
  // Picks was the one list on Home that ignored the density setting while
  // looking like it honoured it.
  row: {
    paddingHorizontal: SECTION_H_PADDING,
  },
});
