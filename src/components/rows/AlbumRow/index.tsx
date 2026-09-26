import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Ellipsis, Link, ArrowDownCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Album } from '@/domain/entities/Album';
import AlbumOptions from '@/components/options/AlbumOptions';
import IconActionButton from '@/components/IconActionButton';
import MediaListRow from '@/components/MediaListRow';
import { useTheme } from '@/features/theme/useTheme';
import { useSheetRef } from '@/components/useSheetRef';
import { useExternalAlbumStatus } from '@/features/downloaders/useExternalAlbumStatus';
import { iconSize, spacing, statusColor, typography } from '@/constants/design';

type AlbumRowAlbum = Album;

/**
 * True when `album` came from an external catalog (Deezer/etc) rather than
 * the user's library — read off `provenance`, the one place that
 * distinction lives now that there is a single `Album` type.
 */
export function isExternalAlbum(album: AlbumRowAlbum): boolean {
  return album.provenance.origin === 'integration';
}

type Props = {
  album: AlbumRowAlbum;
  onPress?: (album: AlbumRowAlbum) => void;
  /** Replaces the album's own subtext line, e.g. the release year in the
   * artist screen's chronological discography. */
  subtextOverride?: string;
};

const AlbumRow: React.FC<Props> = ({
  album,
  onPress,
  subtextOverride,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const optionsSheetRef = useSheetRef();

  // Disabled (no-op) for library albums — useExternalAlbumStatus already
  // guards all its queries on the album argument being non-null, so this
  // stays a no-op for plain library rows exactly as it did before the two
  // row components were merged.
  const status = useExternalAlbumStatus(isExternalAlbum(album) ? album : null);

  const handlePress = useCallback(() => onPress?.(album), [onPress, album]);

  const handleOptionsPress = useCallback(() => {
    optionsSheetRef.current?.present();
  }, [optionsSheetRef]);

  if (isExternalAlbum(album)) {
    const statusBadge =
      status.kind === 'in_library' ? (
        <Link size={iconSize.badge} color={statusColor.success} />
      ) : status.kind === 'downloading' ? (
        <View style={styles.badge}>
          <ArrowDownCircle size={iconSize.badge} color={statusColor.downloading} />
          <Text style={[styles.badgeText, styles.badgeTextBlue]}>{status.progress}%</Text>
        </View>
      ) : null;

    return (
      <>
        <MediaListRow
          title={album.title}
          subtitle={subtextOverride ?? album.artist.name}
          subtitleTrailing={statusBadge}
          cover={album.cover}
          onPress={handlePress}
          trailing={
            <IconActionButton
              icon={<Ellipsis size={iconSize.header} color={colors.secondary} />}
              onPress={handleOptionsPress}
              accessibilityLabel={t('a11y.common.moreOptions')}
              size="compact"
            />
          }
        />

        <AlbumOptions ref={optionsSheetRef} album={album} />
      </>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MediaListRow
        title={album.title}
        subtitle={subtextOverride ?? album.artist.name}
        cover={album.cover}
        onPress={handlePress}
        trailing={
          <IconActionButton
            icon={<Ellipsis size={iconSize.header} color={colors.secondary} />}
            onPress={handleOptionsPress}
            accessibilityLabel={t('a11y.rows.options', { title: album.title })}
            size="compact"
          />
        }
        style={styles.row}
      />

      <AlbumOptions
        ref={optionsSheetRef}
        album={album}
        hideGoToAlbum={false}
      />
    </View>
  );
};

export default memo(AlbumRow);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  row: {
    paddingHorizontal: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '500',
  },
  badgeTextBlue: {
    color: statusColor.downloading,
  },
});
