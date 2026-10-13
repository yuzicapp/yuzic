import React, { useCallback, useState } from 'react';
import {FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/toast';
import { CloudOff, Ellipsis, Link2 } from 'lucide-react-native';
import { confirmDestructive } from '@/components/confirmDestructive';
import { formatDate } from '@/components/formatDate';

import { useApi } from '@/providers/registry/useApi';
import type { Share } from '@/providers/contracts/ServerAdapter';
import { DetailHeaderBar } from '@/components/DetailHeader';
import Touchable from '@/components/Touchable';
import SkeletonListRow from '@/components/SkeletonListRow';
import { FormSheet, FormSheetField } from '@/components/FormSheet';
import RadioMark from '@/components/options/RadioMark';
import { ShareLinkOptions } from '@/components/options/ShareLinkOptions';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useListDensity } from '@/features/theme/useListDensity';
import { contentWidth, hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerOnlyQuery } from '@/features/connectivity/useServerOnlyQuery';
import ServerFeatureState from '@/components/ServerFeatureState';
import { shareItem } from '@/features/shares/share';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What an edit does to a share's expiry: leave it, clear it, or set it this far out. */
const EXPIRY_CHOICES = [
  { id: 'keep', labelKey: 'shares.expiry.keep' },
  { id: 'never', labelKey: 'shares.expiry.never' },
  { id: 'day', labelKey: 'shares.expiry.day', days: 1 },
  { id: 'week', labelKey: 'shares.expiry.week', days: 7 },
  { id: 'month', labelKey: 'shares.expiry.month', days: 30 },
] as const;

type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]['id'];


function formatExpiry(t: (k: string, opts?: any) => string, value: string | undefined): string {
  if (!value) return t('shares.neverExpires');
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value;
  const now = Date.now();
  if (ms <= now) return t('shares.expired');
  return t('shares.expiresOn', { date: formatDate(value, { fallback: value }) });
}

/**
 * Everything a user has shared — the piece that was missing. Users could
 * create a share from Album/Playlist options but had no way to list, copy,
 * revoke, or re-share their existing shares from inside the app. Every one
 * of those needs is one row on this screen.
 */
export default function SharesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const scrollClearance = useScrollClearance();
  const density = useListDensity();
  const api = useApi();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Share | null>(null);
  const [optionsFor, setOptionsFor] = useState<Share | null>(null);

  const sharesQuery = useServerOnlyQuery<Share>({
    queryKey: [QueryKeys.Shares],
    list: api.shares ? () => api.shares!.list() : undefined,
    staleTime: 1000 * 60 * 5,
  });

  const shareCount = sharesQuery.data?.length ?? 0;

  // The row's primary action reopens the OS share sheet — every platform's
  // sheet has "Copy Link" built in, so keeping a separate Copy row here
  // would duplicate an affordance and require a native clipboard dep the
  // app doesn't otherwise need.
  const handleShareAgain = useCallback(async (share: Share) => {
    await shareItem({
      url: share.url,
      title: share.description ?? undefined,
      message: share.description ?? share.url,
    });
  }, []);

  const handleDelete = useCallback((share: Share) => {
    confirmDestructive({
      title: t('shares.deleteTitle'),
      body: t('shares.deleteBody', { title: share.description ?? share.url }),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('shares.revoke'),
      onConfirm: async () => {
            try {
              await api.shares?.remove(share.id);
              await queryClient.invalidateQueries({ queryKey: [QueryKeys.Shares] });
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
    });
  }, [api.shares, queryClient, t]);

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  const renderShare = useCallback(
    ({ item }: { item: Share }) => (
      <View style={[styles.row, { paddingVertical: density.rowPadding }]}>
        <View style={styles.rowText}>
          <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
            {item.description || item.url}
          </Text>
          <Text style={[styles.url, { color: colors.subtext }]} numberOfLines={1}>
            {item.url}
          </Text>
          <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
            {[
              formatExpiry(t, item.expires),
              typeof item.visitCount === 'number'
                ? t('shares.visits', { count: item.visitCount })
                : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Touchable
          testID="share-options"
          onPress={() => setOptionsFor(item)}
          hitSlop={hitSlopFor(icons.row)}
          style={styles.actionBtn}
          feedback="control"
          accessibilityRole="button"
          accessibilityLabel={t('a11y.rows.options', { title: item.description || item.url })}
        >
          <Ellipsis size={icons.row} color={colors.subtext} />
        </Touchable>
      </View>
    ),
    [colors.secondary, colors.subtext, t, density.rowPadding, icons]
  );

  return (
    <SafeAreaView
      testID="shares-screen"
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar
        title={t('shares.title')}
        subtitle={shareCount > 0 ? t('library.count.shares', { count: shareCount }) : undefined}
      />
      <ServerFeatureState
        query={sharesQuery}
        icon={<Link2 size={iconSize.emptyState} color={colors.subtext} />}
        offlineIcon={<CloudOff size={iconSize.emptyState} color={colors.subtext} />}
        skeleton={
          <View style={styles.listContent}>
            {[...Array(6)].map((_, i) => <SkeletonListRow key={i} />)}
          </View>
        }
        unavailableMessage={t('shares.unavailable')}
        emptyMessage={t('shares.empty')}
      >
        {() => (
        <FlatList
          data={sharesQuery.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: scrollClearance }]}
          ItemSeparatorComponent={renderSeparator}
          // Its two siblings have had pull-to-refresh all along; this screen is
          // the same list of the same kind of thing and simply never got one.
          refreshControl={
            <RefreshControl
              refreshing={sharesQuery.isRefetching}
              onRefresh={() => void sharesQuery.refetch()}
              tintColor={colors.secondary}
            />
          }
          renderItem={renderShare}
        />
        )}
      </ServerFeatureState>

      {optionsFor && (
        <ShareLinkOptions
          share={optionsFor}
          onClose={() => setOptionsFor(null)}
          onShare={() => { void handleShareAgain(optionsFor); }}
          onEdit={() => setEditing(optionsFor)}
          onRevoke={() => handleDelete(optionsFor)}
        />
      )}

      {editing && <EditShareSheet share={editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}

/**
 * Renames a share and changes when it stops working.
 *
 * The server could always do both (`updateShare`); the app could only revoke
 * a link and make a new one, which changes its address for everyone it was
 * sent to.
 */
function EditShareSheet({ share, onClose }: { share: Share; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const api = useApi();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(share.description ?? '');
  const [expiry, setExpiry] = useState<ExpiryChoice>('keep');

  const expiresAtMs = (): number | null | undefined => {
    const choice = EXPIRY_CHOICES.find(option => option.id === expiry);
    if (!choice || choice.id === 'keep') return undefined;
    if (choice.id === 'never') return null;
    return Date.now() + choice.days * DAY_MS;
  };

  const changed = description.trim() !== (share.description ?? '') || expiry !== 'keep';

  return (
    <FormSheet
      title={t('shares.editTitle')}
      submitLabel={t('common.save')}
      canSubmit={changed && Boolean(api.shares)}
      onSubmit={async () => {
        try {
          await api.shares!.update({ id: share.id, description: description.trim(), expiresAtMs: expiresAtMs() });
          await queryClient.invalidateQueries({ queryKey: [QueryKeys.Shares] });
          notify.success(t('shares.updated'));
          return true;
        } catch {
          notify.error(t('shares.updateFailed'));
          return false;
        }
      }}
      onClose={onClose}
    >
      <FormSheetField
        label={t('shares.field.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={share.url}
      />
      <Text style={[styles.expiryLabel, { color: colors.subtext }]}>{t('shares.expiry.label')}</Text>
      {EXPIRY_CHOICES.map(option => (
        <Touchable
          key={option.id}
          testID={`share-expiry-${option.id}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: expiry === option.id }}
          onPress={() => setExpiry(option.id)}
          style={styles.expiryRow}
        >
          <Text style={[styles.expiryText, { color: colors.secondary }]}>{t(option.labelKey)}</Text>
          <RadioMark selected={expiry === option.id} />
        </Touchable>
      ))}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.page,
    gap: spacing.sm,
    // A column of rows, capped and centred like every other one. A
    // `FlatList` takes a width here, unlike a `FlashList`.
    width: '100%',
    maxWidth: contentWidth.readable,
    alignSelf: 'center',
  },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, minWidth: 0 },
  title: { ...typography.rowTitle },
  url: { ...typography.caption, marginTop: spacing.xxs },
  meta: { ...typography.caption, marginTop: spacing.xxs },
  actionBtn: { padding: spacing.sm },
  expiryLabel: { ...typography.caption, marginTop: spacing.sm },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  expiryText: { ...typography.body },
});
