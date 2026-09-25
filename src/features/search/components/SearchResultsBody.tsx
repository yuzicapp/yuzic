import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { onDark, spacing, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import SkeletonListRow from '@/components/SkeletonListRow';
import { getSourceMeta } from '@/features/sources/registry';
import type { useSearchScreenModel } from '@/features/search/useSearchScreenModel';
import RecentSearches from './RecentSearches';
import SearchBrowse from '../browse/SearchBrowse';
import ResultRow from './results/ResultRow';

type Model = ReturnType<typeof useSearchScreenModel>;

/**
 * The scrollable body: recent searches when idle, a skeleton while loading,
 * or the results themselves — library rows in one flat list, "Other sources"
 * rows grouped under their source's own labelled header. Library and
 * external are never both on screen (`m.isOtherScope` picks exactly one),
 * the render-side half of the Library-XOR-Other-sources rule the fetch side
 * enforces in `planSearchLegs`.
 */
export default function SearchResultsBody({ m }: { m: Model }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();

  /**
   * Nothing typed: browse, unless the field is focused and there is history.
   *
   * Recent searches belong to the act of typing — they are only useful with a
   * cursor in the field — so an unfocused screen offers ways into the library
   * instead, and the tab stops opening on nothing at all. Focusing with no
   * history yet keeps the browse tiles rather than replacing them with a blank
   * screen, which is what the old idle state did to anyone who had not searched
   * before.
   */
  if (m.query.trim() === '') {
    const hasHistory = m.recentQueries.length > 0 || m.recentEntities.length > 0;

    if (m.isInputFocused && hasHistory) {
      return (
        <RecentSearches
          queries={m.recentQueries}
          entities={m.recentEntities}
          onQueryPress={m.onRecentQueryPress}
          onEntityPress={m.onRecentEntityPress}
          onRemove={m.onRemoveRecent}
          onClear={m.onClearRecent}
        />
      );
    }

    return <SearchBrowse />;
  }

  if (m.isLoading) {
    return <>{[...Array(8)].map((_, i) => <SkeletonListRow key={i} />)}</>;
  }

  const row = (result: Parameters<typeof ResultRow>[0]['result']) => (
    <ResultRow
      result={result}
      activeServerId={m.activeServerId}
      navigation={m.navigation}
      navigateToAlbum={m.navigateToAlbum}
      navigateToArtist={m.navigateToArtist}
      onSelect={m.selectResult}
      onSongPress={m.onSongPress}
      onSongOptions={m.onSongOptions}
    />
  );

  return (
    <>
      {!m.isOtherScope && m.libraryResults.map(result => (
        <View key={`local:${result.type}:${result.id}`} style={styles.resultBlock}>
          {row(result)}
        </View>
      ))}

      {m.isOtherScope && Array.from(m.externalResultsBySource.entries()).map(([sourceId, results]) => {
        const meta = getSourceMeta(sourceId);
        const label = meta?.label ?? sourceId;
        const color = meta?.color ?? colors.subtext;
        const letter = label.charAt(0).toUpperCase();
        return (
          <React.Fragment key={sourceId}>
            <View style={styles.sourceHeader}>
              {m.showSourceHeaders && (
                <View style={[styles.sourceBadge, { backgroundColor: color, borderRadius: rad.pill }]}>
                  <Text style={styles.sourceBadgeLetter}>{letter}</Text>
                </View>
              )}
              <Text style={[styles.sourceHeaderText, { color: colors.subtext }]}>{label}</Text>
            </View>
            {results.map((result, i) => (
              <View key={`external:${result.type}:${result.id}`} style={[styles.resultBlock, i === 0 && styles.resultBlockFirst]}>
                {row(result)}
              </View>
            ))}
          </React.Fragment>
        );
      })}

      {m.noResultsForScope && (
        <Text testID="search-no-results" style={[styles.noResults, { color: colors.subtext }]}>
          {t('search.noResults')}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  resultBlock: {},
  resultBlockFirst: {
    paddingTop: spacing.sm,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.xs,
  },
  sourceBadge: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBadgeLetter: {
    ...typography.micro,
    fontWeight: '500',
    color: onDark.text,
  },
  sourceHeaderText: {
    ...typography.rowSubtitle,
    fontWeight: '500',
  },
  noResults: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
