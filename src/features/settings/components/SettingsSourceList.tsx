import { iconSize, onDark, spacing, tinted, typography } from '@/constants/design';
import React, { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  NestedReorderableList,
  ScrollViewContainer,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { useTranslation } from 'react-i18next';
import { Check, GripVertical } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';

type SettingsSource = {
  id: string;
  label: string;
  subtext?: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

type Props = {
  sources: SettingsSource[];
  /** Persisted source IDs; newly available sources follow the known order. */
  sourceOrder?: string[];
  onOrderChange: (sourceIds: string[]) => void;
  pinnedSource?: { label: string; subtext: string };
  showSubtext?: boolean;
};

/** The scroll container a screen holding these lists hands `SettingsScreen`. */
export const SourceListScrollContainer = ScrollViewContainer;

type SourceRowProps = {
  item: SettingsSource;
  canReorder: boolean;
  showSubtext: boolean;
};

/**
 * One source row. Separate because `useReorderableDrag` and `useIsActive` read
 * the list's context, which exists only inside what `renderItem` renders.
 */
function SourceRow({ item, canReorder, showSubtext }: SourceRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <View style={[styles.sourceRow, isActive && { backgroundColor: colors.background }]}>
      <View style={styles.sourceCopy}>
        <Text style={[styles.sourceLabel, { color: colors.secondary }]}>{item.label}</Text>
        {showSubtext && item.subtext && (
          <Text style={[styles.sourceSubtext, { color: colors.subtext }]}>{item.subtext}</Text>
        )}
      </View>
      <View style={styles.sourceControls}>
        {canReorder && item.enabled && (
          <Touchable
            testID={`source-drag-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.settings.reorderSource', { name: item.label })}
            onLongPress={drag}
            disabled={isActive}
            style={styles.dragHandle}
          >
            <GripVertical size={iconSize.row} color={colors.border} />
          </Touchable>
        )}
        <Switch
          accessibilityLabel={item.label}
          value={item.enabled}
          onValueChange={item.onEnabledChange}
          trackColor={{ true: colors.themeColor }}
          thumbColor={onDark.text}
        />
      </View>
    </View>
  );
}

/**
 * A feature-owned fallback chain. Rendered inside a `SettingsScreen` given
 * `SourceListScrollContainer`, which is what lets the page scroll over it.
 *
 * A feature-owned fallback chain. Its caller supplies the persisted ordering;
 * this component only exposes order when moving a source changes resolution.
 */
const SettingsSourceList: React.FC<Props> = ({
  sources,
  sourceOrder = [],
  onOrderChange,
  pinnedSource,
  showSubtext = true,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const orderedSources = useMemo(() => {
    const position = new Map(sourceOrder.map((id, index) => [id, index]));
    return [...sources].sort((left, right) => (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  }, [sourceOrder, sources]);
  const enabledCount = useMemo(() => orderedSources.filter(source => source.enabled).length, [orderedSources]);
  const canReorder = enabledCount > 1;

  const renderSource = ({ item }: { item: SettingsSource }) => (
    <SourceRow item={item} canReorder={canReorder} showSubtext={showSubtext} />
  );

  return (
    <View>
      {pinnedSource && (
        <View style={styles.sourceRow} testID="settings-source-pinned">
          <View style={styles.sourceCopy}>
            <Text style={[styles.sourceLabel, { color: colors.secondary }]}>{pinnedSource.label}</Text>
            <Text style={[styles.sourceSubtext, { color: colors.subtext }]}>{pinnedSource.subtext}</Text>
          </View>
          <View style={[styles.alwaysFirst, { backgroundColor: tinted(colors.themeColor, 'surface'), borderRadius: rad.pill }]}>
            <Check size={iconSize.badge} color={colors.themeColor} />
            <Text style={[styles.alwaysFirstText, { color: colors.themeColor }]}>
              {t('settings.sources.alwaysFirst')}
            </Text>
          </View>
        </View>
      )}

      <NestedReorderableList
        data={orderedSources}
        keyExtractor={source => source.id}
        renderItem={renderSource}
        onReorder={({ from, to }) =>
          onOrderChange(reorderItems(orderedSources, from, to).map(source => source.id))
        }
        // The page this sits in owns the scrolling; this list only reorders.
        // `scrollable` is the library's autoscroll-during-drag behaviour and
        // `scrollEnabled` the FlatList's own — both off, or React Native logs
        // "VirtualizedLists should never be nested inside plain ScrollViews",
        // which it decides purely on `scrollEnabled !== false`. The list is
        // laid out at full height inside the page, so it has nothing to scroll.
        scrollable={false}
        scrollEnabled={false}
        // `useIsActive` in the row only re-renders when this is set.
        shouldUpdateActiveItem
      />
    </View>
  );
};

export default SettingsSourceList;

const styles = StyleSheet.create({
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceLabel: { ...typography.rowTitle },
  sourceSubtext: { ...typography.caption, marginTop: spacing.xxs },
  sourceControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  dragHandle: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, padding: spacing.xs },
  alwaysFirst: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  alwaysFirstText: { ...typography.caption, fontWeight: '600' },
});
