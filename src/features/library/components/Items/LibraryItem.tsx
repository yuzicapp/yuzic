import { hitSlopFor, iconSize, radius, spacing, typography } from '@/constants/design';
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react-native';
import { MediaImage } from '@/components/MediaImage';
import { CoverSource } from '@/domain/entities/Cover';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { useListDensity } from '@/features/theme/useListDensity';
import Touchable from '@/components/Touchable';

type Props = {
  cover: CoverSource;
  title: string;
  /**
   * The second line, or `undefined` for a row that has none.
   *
   * The distinction matters: an empty string still reserves the line, so a
   * track with no artist stays aligned with the tracks either side of it,
   * while `undefined` removes it — which is what a screen of nothing but
   * artists wants, since "Artist" under every name is the same word 26 times.
   */
  subtext?: string;
  isGridView: boolean;
  gridWidth: number;
  gridSpacing?: number;
  circularImage?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
  /**
   * An id for the title text itself, distinct from the cell's `testID`.
   *
   * Every cell in a collection shares one `testID`, so a *specific* item can
   * otherwise only be addressed by its text — which is layout-dependent, and
   * fails on a multi-column grid where a scroll steps a whole row at a time.
   */
  titleTestID?: string;
};

const LibraryItem: React.FC<Props> = ({
  cover,
  title,
  subtext,
  isGridView,
  gridWidth,
  gridSpacing = 8,
  circularImage = false,
  onPress,
  onLongPress,
  testID,
  titleTestID,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const density = useListDensity();

  const listRadius = circularImage ? radius.pill : rad.md;
  const gridRadius = circularImage ? radius.pill : rad.card;

  return (
    <Touchable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={
        isGridView
          ? [styles.gridContainer, { width: gridWidth, marginHorizontal: gridSpacing, marginVertical: gridSpacing, borderRadius: rad.md }]
          : [styles.listContainer, { paddingVertical: density.libraryRowPadding }]
      }
    >
      <MediaImage
        cover={cover}
        size={isGridView ? 'grid' : 'thumb'}
        style={
          isGridView
            ? { width: gridWidth, aspectRatio: 1, borderRadius: gridRadius }
            : { width: 52, height: 52, borderRadius: listRadius, marginRight: spacing.md }
        }
      />

      <View style={isGridView ? styles.gridText : styles.listText}>
        <Text testID={titleTestID} style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtext !== undefined && (
          <Text style={[styles.subtext, { color: colors.subtext }]} numberOfLines={1}>
            {subtext}
          </Text>
        )}
      </View>

      {!isGridView && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.rows.options', { title })}
          onPress={onLongPress}
          hitSlop={hitSlopFor(18)}
          feedback="control"
        >
          <Ellipsis size={iconSize.row} color={colors.subtext} />
        </Touchable>
      )}
    </Touchable>
  );
};

export default memo(LibraryItem);

const styles = StyleSheet.create({
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  gridContainer: {},
  listText: {
    flex: 1,
    marginRight: spacing.md,
  },
  gridText: {
    marginTop: spacing.tight,
    width: '100%',
  },
  title: {
    ...typography.compactRowTitle,
  },
  subtext: {
    ...typography.caption,
    // Reserved rather than measured: a grid where one tile's artist is blank
    // and its neighbour's is not used to put the two titles on different
    // baselines, which reads as a layout bug rather than as missing data.
    minHeight: typography.caption.lineHeight,
  },
});
