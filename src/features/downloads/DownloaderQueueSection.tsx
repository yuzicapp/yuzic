import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle, X } from 'lucide-react-native';

import { notify } from '@/components/toast';
import { MediaImage } from '@/components/MediaImage';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { hitSlopFor, iconSize, spacing, statusColor, typography } from '@/constants/design';
import type { Album } from '@/domain/entities/Album';
import { albumCoverSubject, missingCover, type CoverSource } from '@/domain/entities/Cover';
import { useAlbums } from '@/features/album/useAlbums';
import { matchesAlbum, type DownloaderQueueItem } from '@/features/downloaders/queueItem';
import { useQueueRowSubtitle } from '@/features/settings/downloaders/useQueueRowSubtitle';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import type { DownloaderId } from '@/state/redux/slices/downloadersSlice';

type Props = {
  id: DownloaderId;
  title: string;
  items: DownloaderQueueItem[];
  isLoading: boolean;
  hasError: boolean;
  /** Absent when the downloader offers no way to stop a transfer. */
  cancelItem?: (item: DownloaderQueueItem) => Promise<void>;
};

const COVER_SIZE = 48;

/**
 * The picture for one transfer.
 *
 * The library's own copy once it has one — that is the record the row opens,
 * and its cover is the one the rest of the app draws for it. Until then, the
 * transfer is for something the server has never seen, so there is no cover
 * to find: what there is, is the album's *name*, and naming the subject is
 * all the one picture rule needs to go and ask an artwork backup for it.
 *
 * That gap is why this screen drew nothing. A transfer in flight is by
 * definition not in the library yet, so the fallback was a bare
 * `{ kind: 'none' }` — a gap about nobody, which `coverResolution` returns
 * untouched — and the placeholder was the answer for every row that mattered.
 */
function coverFor(item: DownloaderQueueItem, album: Album | null): CoverSource {
  if (album) return album.cover;
  return missingCover(albumCoverSubject(item.title, item.artistName || item.peer));
}

/**
 * One downloader's transfers, drawn the way the library draws its rows.
 *
 * The Downloads screen used to borrow the settings card for this — a boxed
 * list of plain text rows with nothing to press. A transfer is almost always an
 * album, and once the album is in the library it is the thing you want to open,
 * so each row carries that album's cover and opens it. A transfer the library
 * does not have yet shows its progress and nothing more; a row with problems
 * reported opens to show them instead.
 */
export default function DownloaderQueueSection({ id, title, items, isLoading, hasError, cancelItem }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const navigation = useNavigation<any>();
  const subtitleFor = useQueueRowSubtitle();
  const { albums } = useAlbums();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const albumFor = useMemo(() => {
    const cache = new Map<string, Album | null>();
    return (item: DownloaderQueueItem): Album | null => {
      if (!cache.has(item.id)) {
        cache.set(item.id, albums.find(album => matchesAlbum(item, { title: album.title, artist: album.artist.name })) ?? null);
      }
      return cache.get(item.id) ?? null;
    };
  }, [albums]);

  const runCancel = useCallback(async (item: DownloaderQueueItem) => {
    if (!cancelItem) return;
    setCancellingId(item.id);
    try {
      await cancelItem(item);
      notify.success(t('settings.downloaders.cancelled'));
    } catch {
      notify.error(t('settings.downloaders.cancelFailed'));
    } finally {
      setCancellingId(current => (current === item.id ? null : current));
    }
  }, [cancelItem, t]);

  const confirmCancel = useCallback((item: DownloaderQueueItem, label: string) => {
    Alert.alert(
      t('settings.downloaders.cancelTitle'),
      t('settings.downloaders.cancelBody', { title: label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.downloaders.cancelConfirm'), style: 'destructive', onPress: () => { void runCancel(item); } },
      ]
    );
  }, [runCancel, t]);

  const renderRow = (item: DownloaderQueueItem) => {
    const label = item.title || t('settings.downloaders.unknown');
    const percent = Math.max(0, Math.min(100, Math.round(item.percentComplete)));
    const album = albumFor(item);
    const warnings = item.warnings ?? [];
    const expanded = expandedId === item.id;
    const onPress = album
      ? () => navigation.navigate('albumView', { id: album.nativeId })
      : warnings.length > 0
        ? () => setExpandedId(expanded ? null : item.id)
        : undefined;

    return (
      <Touchable
        key={item.id}
        testID="downloads-queue-row"
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        feedback={onPress ? 'row' : 'none'}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
      >
        <MediaImage
          cover={coverFor(item, album)}
          size="thumb"
          style={[styles.cover, { borderRadius: rad.thumb, backgroundColor: colors.muted }]}
        />
        <View style={styles.body}>
          <View style={styles.titleLine}>
            <View style={styles.text}>
              <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>{label}</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>{subtitleFor(item)}</Text>
            </View>
            {item.active ? (
              <Text style={[styles.percent, { color: colors.subtext }]}>{percent}%</Text>
            ) : (
              <CheckCircle size={iconSize.inline} color={statusColor.success} />
            )}
            {cancelItem && (cancellingId === item.id ? (
              <View style={styles.cancel}><SpinningLoaderCircle size={iconSize.row} color={colors.subtext} /></View>
            ) : (
              <Touchable
                feedback="control"
                style={styles.cancel}
                hitSlop={hitSlopFor(24)}
                onPress={() => confirmCancel(item, label)}
                accessibilityRole="button"
                accessibilityLabel={t('settings.downloaders.cancelAria', { title: label })}
              >
                <X size={iconSize.row} color={statusColor.destructive} />
              </Touchable>
            ))}
          </View>
          {item.active && (
            <View style={[styles.track, { backgroundColor: colors.border, borderRadius: rad.pill }]}>
              <View style={[styles.fill, { backgroundColor: colors.themeColor, width: `${percent}%`, borderRadius: rad.pill }]} />
            </View>
          )}
          {expanded && warnings.map((warning, index) => (
            <Text key={index} style={[styles.warning, { color: colors.subtext }]}>• {warning}</Text>
          ))}
        </View>
      </Touchable>
    );
  };

  return (
    <View testID={`downloader-queue-section-${id}`}>
      <Text style={[styles.sectionLabel, { color: colors.subtext }]}>{title}</Text>
      {isLoading ? (
        <View style={styles.status}><SpinningLoaderCircle size={iconSize.row} color={colors.subtext} /></View>
      ) : hasError ? (
        <Text style={[styles.statusText, { color: colors.subtext }]}>{t(`settings.downloaders.${id}.connectionFailed`)}</Text>
      ) : items.length === 0 ? (
        <Text style={[styles.statusText, { color: colors.subtext }]}>{t('settings.downloaders.emptyQueue')}</Text>
      ) : (
        items.map(renderRow)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.label,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  cover: { width: COVER_SIZE, height: COVER_SIZE },
  body: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.rowTitle },
  subtitle: { ...typography.caption, marginTop: spacing.xxs },
  percent: { ...typography.caption },
  cancel: { padding: spacing.xxs },
  track: { height: 3, width: '100%', overflow: 'hidden', marginTop: spacing.sm },
  fill: { height: '100%' },
  warning: { ...typography.caption, marginTop: spacing.xxs },
  status: { alignItems: 'center', paddingVertical: spacing.lg },
  statusText: { ...typography.rowSubtitle, paddingHorizontal: spacing.page, paddingVertical: spacing.sm },
});
