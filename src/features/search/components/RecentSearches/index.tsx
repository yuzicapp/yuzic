import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import MediaListRow from '@/components/MediaListRow';
import IconActionButton from '@/components/IconActionButton';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers';
import { controlSize, hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import {
  searchHistoryEntryKey,
  type SearchEntityEntry,
  type SearchQueryEntry,
} from '@/state/redux/slices/searchHistorySlice';
import Touchable from '@/components/Touchable';

type Props = {
  queries: SearchQueryEntry[];
  entities: SearchEntityEntry[];
  onQueryPress: (text: string) => void;
  onEntityPress: (entity: SearchEntityEntry) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
};

export default function RecentSearches({
  queries,
  entities,
  onQueryPress,
  onEntityPress,
  onRemove,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();

  const coversToPrefetch = useMemo(() => entities.map(e => e.cover), [entities]);
  usePrefetchCovers(coversToPrefetch, 'thumb');

  if (queries.length === 0 && entities.length === 0) return null;

  return (
    <View style={styles.container} testID="search-recent-section">
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
          {t('search.recentSearches')}
        </Text>
        <Touchable onPress={onClear} hitSlop={hitSlopFor(iconSize.control)}>
          <Text style={[styles.clear, { color: colors.subtext }]}>{t('search.clearRecent')}</Text>
        </Touchable>
      </View>

      {queries.length > 0 && (
        <View style={styles.chipRow}>
          {queries.map(entry => (
            <View
              key={searchHistoryEntryKey(entry)}
              testID="search-recent-chip"
              style={[styles.chip, { backgroundColor: colors.muted, borderRadius: rad.pillFor(controlSize.inlineControl) }]}
            >
              <Touchable
                style={styles.chipMain}
                accessibilityRole="button"
                accessibilityLabel={entry.text}
                onPress={() => onQueryPress(entry.text)}
              >
                <SearchIcon size={icons.badge} color={colors.subtext} />
                <Text style={[styles.chipText, { color: colors.secondary }]} numberOfLines={1}>
                  {entry.text}
                </Text>
              </Touchable>
              <Touchable
                onPress={() => onRemove(searchHistoryEntryKey(entry))}
                hitSlop={hitSlopFor(14)}
                accessibilityRole="button"
                accessibilityLabel={t('search.removeRecentSearch', { query: entry.text })}
              >
                <X size={icons.badge} color={colors.subtext} />
              </Touchable>
            </View>
          ))}
        </View>
      )}

      {entities.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.entityTitle, { color: colors.subtext }]}>
            {t('search.recentlyOpened')}
          </Text>
          {entities.map(entity => (
            <View key={searchHistoryEntryKey(entity)} testID="search-recent-entity">
              <MediaListRow
                title={entity.title}
                subtitle={
                  entity.subtitle
                    ? `${t(`search.entityTypes.${entity.type}`)} · ${entity.subtitle}`
                    : t(`search.entityTypes.${entity.type}`)
                }
                cover={entity.cover}
                roundedCover={entity.type === 'artist'}
                variant="compact"
                onPress={() => onEntityPress(entity)}
                trailing={
                  <IconActionButton
                    icon={<X size={icons.row} color={colors.subtext} />}
                    onPress={() => onRemove(searchHistoryEntryKey(entity))}
                    accessibilityLabel={t('search.removeRecentSearch', { query: entity.title })}
                    size="compact"
                  />
                }
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
  },
  clear: {
    ...typography.caption,
    fontWeight: '500',
  },
  entityTitle: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
    maxWidth: '100%',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  chipText: {
    ...typography.caption,
    flexShrink: 1,
  },
});
