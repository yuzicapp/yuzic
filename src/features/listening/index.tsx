import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import SettingsScreen from '@/features/settings/components/SettingsScreen';
import SettingsCardHeader from '@/features/settings/components/SettingsCardHeader';
import Touchable from '@/components/Touchable';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { spacing, typography } from '@/constants/design';
import { clearListeningHistory } from '@/state/redux/slices/listeningSlice';
import { useCatalogStore } from '@/features/library/useCatalogStore';
import type { Tally } from './listeningSummary';
import {
  useListeningStats,
  type ForgottenTrack,
  type ListeningStats,
} from './useListeningStats';

/**
 * What this device has heard.
 *
 * Every figure is the listener's own, computed on the device, from a log that
 * never leaves it. That is the whole proposition and it is worth being strict
 * about: nothing here characterises the person, scores their taste or tells
 * them what kind of listener they are. It counts what happened, in numbers
 * they can check — which is the part an audience that self-hosts to stop being
 * measured will actually care about, and the part a Wrapped gets wrong.
 *
 * The clock is the surface worth having. Twenty-four bars of "when do you
 * actually listen" is a fact nobody has ever been shown about themselves, it
 * costs one pass over the log, and it needs no account, no network and no
 * other listener's data to be true.
 */

const HOUR_LABELS = [0, 6, 12, 18];

/**
 * The longest a forgotten favourite has gone unplayed, in days.
 *
 * Shown rather than the track's name because this screen has no catalog to
 * resolve a key into a title — that belongs to the rediscovery shelf this
 * feeds, not to a page of figures. "Twenty-three tracks, the longest untouched
 * for two years" is true, checkable, and needs nothing but the log.
 */
function longestGapDays(forgotten: readonly ForgottenTrack[]): number {
  return forgotten.reduce(
    (longest, entry) => Math.max(longest, entry.reason.daysSinceLastPlay ?? 0),
    0,
  );
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 10) return String(Math.round(hours));
  return hours.toFixed(1);
}

const ListeningStatsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const dispatch = useDispatch();
  const stats = useListeningStats();
  const catalog = useCatalogStore();

  // The log stores `serverId:entityId`; the catalog is the only thing that can
  // turn that into a name. A key with no match is dropped rather than shown as
  // a blank row — it means the track left the library, or came from a server
  // that is no longer the active one, and neither is worth a line on screen.
  //
  // Asked of the store's own index rather than a `new Map(tracks.map(...))`
  // built here. Ten names were costing a map over the whole library: at 89,878
  // tracks that is 89,878 insertions to answer five lookups, rebuilt whenever
  // a sync replaced the array.
  const named = (entries: readonly Tally[], nameOf: (nativeId: string) => string | undefined) =>
    entries
      .map(entry => ({ name: nameOf(entry.key.split(':').slice(1).join(':')), plays: entry.plays }))
      .filter((entry): entry is { name: string; plays: number } => !!entry.name)
      .slice(0, 5);

  const topArtists = named(stats.recent.topArtists, id => catalog.artistByNativeId.get(id)?.name);
  const topTracks = named(stats.favourites, id => catalog.songByNativeId.get(id)?.title);

  return (
    <SettingsScreen title={t('settings.listening.title')}>
      {!stats.hasHistory ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>
          {t('settings.listening.empty')}
        </Text>
      ) : (
        <>
          <SettingsCardHeader title={t('settings.listening.allTime')} />
          <Figures
            colors={colors}
            radius={rad.card}
            items={[
              { label: t('settings.listening.plays'), value: String(stats.lifetime.plays) },
              { label: t('settings.listening.hours'), value: formatHours(stats.lifetime.seconds) },
              { label: t('settings.listening.tracks'), value: String(stats.lifetime.tracks) },
            ]}
          />

          <SettingsCardHeader title={t('settings.listening.thisMonth')} />
          <Figures
            colors={colors}
            radius={rad.card}
            items={[
              { label: t('settings.listening.plays'), value: String(stats.recent.plays) },
              { label: t('settings.listening.hours'), value: formatHours(stats.recent.seconds) },
              { label: t('settings.listening.artists'), value: String(stats.recent.artists) },
              { label: t('settings.listening.newToYou'), value: String(stats.discovered.length) },
              { label: t('settings.listening.streak'), value: String(stats.streak) },
              {
                label: t('settings.listening.finished'),
                value: `${Math.round(stats.completion * 100)}%`,
              },
            ]}
          />

          {topArtists.length > 0 ? (
            <>
              <SettingsCardHeader title={t('settings.listening.topArtists')} />
              <Ranked rows={topArtists} colors={colors} radius={rad.card} unit={t('settings.listening.plays')} />
            </>
          ) : null}

          {topTracks.length > 0 ? (
            <>
              <SettingsCardHeader title={t('settings.listening.topTracks')} />
              <Ranked rows={topTracks} colors={colors} radius={rad.card} unit={t('settings.listening.plays')} />
            </>
          ) : null}

          <SettingsCardHeader title={t('settings.listening.whenYouListen')} />
          <Clock stats={stats} colors={colors} radius={rad.card} />

          {stats.forgotten.length > 0 ? (
            <>
              <SettingsCardHeader title={t('settings.listening.worthRevisiting')} />
              <Figures
                colors={colors}
                radius={rad.card}
                items={[
                  {
                    label: t('settings.listening.forgotten'),
                    value: String(stats.forgotten.length),
                  },
                  {
                    label: t('settings.listening.longestGap'),
                    value: String(longestGapDays(stats.forgotten)),
                  },
                ]}
              />
            </>
          ) : null}

          <SettingsCardHeader title={t('settings.listening.howItEnds')} />
          <Figures
            colors={colors}
            radius={rad.card}
            items={[
              { label: t('settings.listening.playedThrough'), value: String(stats.endings.finished) },
              { label: t('settings.listening.skipped'), value: String(stats.endings.skipped) },
            ]}
          />

          <Touchable
            accessibilityRole="button"
            onPress={() => dispatch(clearListeningHistory())}
            style={[styles.clear, { borderRadius: rad.card, backgroundColor: colors.card }]}
          >
            <Text style={[styles.clearLabel, { color: colors.destructive }]}>
              {t('settings.listening.clear')}
            </Text>
          </Touchable>
          <Text style={[styles.note, { color: colors.secondary }]}>
            {t('settings.listening.privacy')}
          </Text>
        </>
      )}
    </SettingsScreen>
  );
};

type Palette = ReturnType<typeof useTheme>['colors'];

const Figures: React.FC<{
  items: { label: string; value: string }[];
  colors: Palette;
  radius: number;
}> = ({ items, colors, radius }) => (
  <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius }]}>
    {items.map(item => (
      <View key={item.label} style={styles.figure}>
        <Text style={[styles.value, { color: colors.text }]}>{item.value}</Text>
        <Text style={[styles.label, { color: colors.secondary }]}>{item.label}</Text>
      </View>
    ))}
  </View>
);

/**
 * A short ranked list with its number beside each row.
 *
 * Five rows, not ten: this is a page of figures, and a top five is a glance
 * where a top fifty is a list the library already does better.
 */
const Ranked: React.FC<{
  rows: { name: string; plays: number }[];
  colors: Palette;
  radius: number;
  unit: string;
}> = ({ rows, colors, radius, unit }) => (
  <View style={[styles.list, { backgroundColor: colors.card, borderRadius: radius }]}>
    {rows.map(row => (
      <View key={row.name} style={styles.row}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.rowValue, { color: colors.secondary }]}>
          {row.plays} {unit.toLowerCase()}
        </Text>
      </View>
    ))}
  </View>
);

/**
 * Twenty-four bars, each an hour, scaled to the busiest.
 *
 * Relative rather than absolute because the shape is the interesting part —
 * somebody who listens at work and somebody who listens at 2am have the same
 * total and completely different pictures, and an axis in plays would hide
 * that behind whoever listens more.
 */
const Clock: React.FC<{ stats: ListeningStats; colors: Palette; radius: number }> = ({
  stats,
  colors,
  radius,
}) => {
  const peak = useMemo(() => Math.max(1, ...stats.window.byHour), [stats.window.byHour]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius }]}>
      <View style={styles.clock}>
        {stats.window.byHour.map((plays, hour) => (
          <View key={hour} style={styles.column}>
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: plays > 0 ? colors.themeColor : colors.muted,
                  // A share of the tallest bar. The only proportional value on
                  // the screen, so it is a flex weight rather than a height in
                  // points — the row sizes itself and nothing needs a literal.
                  flexGrow: Math.max(0.04, plays / peak),
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.clockAxis}>
        {HOUR_LABELS.map(hour => (
          <Text key={hour} style={[styles.axisLabel, { color: colors.secondary }]}>
            {String(hour).padStart(2, '0')}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  figure: { minWidth: '33%' },
  value: { ...typography.sectionTitle },
  label: { ...typography.rowSubtitle },
  clock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: spacing.chartHeight,
    width: '100%',
    columnGap: spacing.xxs,
  },
  column: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%' },
  clockAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.xs,
  },
  axisLabel: { ...typography.caption },
  list: { padding: spacing.md, marginBottom: spacing.md, rowGap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', columnGap: spacing.md },
  rowName: { ...typography.rowTitle, flexShrink: 1 },
  rowValue: { ...typography.rowSubtitle },
  empty: { ...typography.rowSubtitle, padding: spacing.md },
  clear: { padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  clearLabel: { ...typography.rowTitle },
  note: { ...typography.caption, padding: spacing.md },
});

export default ListeningStatsScreen;
