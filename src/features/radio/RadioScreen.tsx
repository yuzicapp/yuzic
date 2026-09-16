import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { notify } from '@/components/toast';
import { CloudOff, Ellipsis, Radio as RadioIcon } from 'lucide-react-native';

import { useApi } from '@/providers/registry/useApi';
import type { InternetRadioStation } from '@/providers/contracts/ServerAdapter';
import { stationToSong } from '@/features/radio/buildStationSong';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { DetailHeaderBar, DetailHeaderIconButton } from '@/components/DetailHeader';
import { FormSheet, FormSheetField } from '@/components/FormSheet';
import { RadioListOptions, RadioStationOptions } from '@/components/options/RadioOptions';
import MediaListRow from '@/components/MediaListRow';
import Touchable from '@/components/Touchable';
import EmptyState from '@/components/EmptyState';
import SkeletonListRow from '@/components/SkeletonListRow';
import { controlSize, hitSlopFor, iconSize, spacing } from '@/constants/design';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { useRadius } from '@/features/theme/useRadius';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useTheme } from '@/features/theme/useTheme';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import haptics from '@/components/haptics';

type Editing =
  | { mode: 'add' }
  | { mode: 'edit'; station: InternetRadioStation };

/**
 * Radio browsing surface — Navidrome only (the empty adapter's `api.radio` is
 * undefined, and the LibraryEntryRows entry hides itself accordingly, so
 * reaching this screen already means the server supports it).
 *
 * Built like every other list screen here: the shared bar with one "…" for
 * what applies to the list, and a row whose own "…" carries what applies to
 * one station (`components/options/RadioOptions`). The actions used to be
 * bare icons — a "+" on the bar, a pencil and a bin on each row — which made
 * this the only screen where a destructive action sat one stray tap from the
 * row you press to play.
 */
export default function RadioScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const api = useApi();
  const queryClient = useQueryClient();
  const serverReachable = useServerReachable();
  const scrollClearance = useScrollClearance();
  const { playSong } = usePlayingActions();
  const activeServer = useSelector(selectActiveServer);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [optionsFor, setOptionsFor] = useState<InternetRadioStation | null>(null);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);

  const stationsQuery = useQuery({
    queryKey: [QueryKeys.Radio],
    queryFn: async () => (await api.radio?.list()) ?? [],
    enabled: Boolean(api.radio) && serverReachable,
    staleTime: 1000 * 60 * 5,
  });

  const handlePlay = useCallback((station: InternetRadioStation) => {
    if (!activeServer?.id) return;
    haptics.primary();
    void playSong(stationToSong(station, activeServer.id));
  }, [activeServer?.id, playSong]);

  const handleDelete = useCallback((station: InternetRadioStation) => {
    Alert.alert(
      t('radio.deleteTitle'),
      t('radio.deleteBody', { name: station.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.radio?.remove(station.id);
              await queryClient.invalidateQueries({ queryKey: [QueryKeys.Radio] });
            } catch {
              notify.error(t('common.error.unexpected'));
            }
          },
        },
      ]
    );
  }, [api.radio, queryClient, t]);

  // The station's own page, where it has one. A stream URL is not a page, so
  // this is offered only for the field the editor asks for by name.
  const handleOpenHomepage = useCallback(async (station: InternetRadioStation) => {
    if (!station.homepageUrl) return;
    try {
      await Linking.openURL(station.homepageUrl);
    } catch {
      notify.error(t('radio.openFailed'));
    }
  }, [t]);

  const closeEditor = useCallback(() => setEditing(null), []);
  const refreshList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [QueryKeys.Radio] });
  }, [queryClient]);

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  const renderStation = useCallback(
    ({ item }: { item: InternetRadioStation }) => (
      <MediaListRow
        testID="radio-station-row"
        title={item.name}
        subtitle={item.homepageUrl || item.streamUrl}
        cover={{ kind: 'none' }}
        showCover={false}
        variant="compact"
        onPress={() => handlePlay(item)}
        leading={<StationIcon />}
        trailing={
          <Touchable
            testID="radio-station-options"
            onPress={() => setOptionsFor(item)}
            hitSlop={hitSlopFor(iconSize.row)}
            style={styles.rowAction}
            feedback="control"
            accessibilityRole="button"
            accessibilityLabel={t('a11y.rows.options', { title: item.name })}
          >
            <Ellipsis size={iconSize.row} color={colors.subtext} />
          </Touchable>
        }
      />
    ),
    [handlePlay, colors.subtext, t]
  );

  const stationCount = stationsQuery.data?.length ?? 0;

  return (
    <SafeAreaView
      testID="radio-screen"
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar
        title={t('radio.title')}
        subtitle={
          stationCount > 0 ? t('library.count.stations', { count: stationCount }) : undefined
        }
        rightAction={
          <DetailHeaderIconButton
            onPress={() => setListOptionsOpen(true)}
            accessibilityLabel={t('a11y.common.moreOptions')}
          >
            <Ellipsis size={iconSize.header} color={colors.secondary} />
          </DetailHeaderIconButton>
        }
      />

      {!serverReachable && !stationsQuery.data?.length ? (
        <EmptyState
          icon={<CloudOff size={iconSize.emptyState} color={colors.subtext} />}
          message={t('common.offline.serverOnlyFeature')}
        />
      ) : stationsQuery.isLoading ? (
        <View style={styles.listContent}>
          {[...Array(8)].map((_, i) => (
            <SkeletonListRow key={i} artSize={controlSize.compactMediaRowArt} />
          ))}
        </View>
      ) : stationsQuery.isError ? (
        <EmptyState
          icon={<RadioIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('common.loadFailed')}
          action={{ label: t('common.retry'), onPress: () => stationsQuery.refetch() }}
        />
      ) : !stationsQuery.data?.length ? (
        <EmptyState
          icon={<RadioIcon size={iconSize.emptyState} color={colors.subtext} />}
          message={t('radio.empty')}
          action={{ label: t('radio.add'), onPress: () => setEditing({ mode: 'add' }) }}
        />
      ) : (
        <FlatList
          data={stationsQuery.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: scrollClearance }]}
          ItemSeparatorComponent={renderSeparator}
          renderItem={renderStation}
        />
      )}

      {listOptionsOpen && (
        <RadioListOptions
          title={t('radio.title')}
          subtitle={
            stationCount > 0 ? t('library.count.stations', { count: stationCount }) : undefined
          }
          onClose={() => setListOptionsOpen(false)}
          onAdd={() => setEditing({ mode: 'add' })}
          onRefresh={() => { void refreshList(); }}
        />
      )}

      {optionsFor && (
        <RadioStationOptions
          station={optionsFor}
          onClose={() => setOptionsFor(null)}
          onPlay={() => handlePlay(optionsFor)}
          onEdit={() => setEditing({ mode: 'edit', station: optionsFor })}
          onOpenHomepage={() => { void handleOpenHomepage(optionsFor); }}
          onDelete={() => handleDelete(optionsFor)}
        />
      )}

      {editing && (
        <StationEditor
          initial={editing.mode === 'edit' ? editing.station : null}
          onClose={closeEditor}
          onSaved={refreshList}
        />
      )}
    </SafeAreaView>
  );
}

/** The stand-in for artwork a stream does not have. Sized like the thumbnail
 *  it replaces so the titles line up with every other compact row. */
function StationIcon() {
  const { colors } = useTheme();
  const rad = useRadius();
  return (
    <View style={[styles.iconWrap, { backgroundColor: colors.muted, borderRadius: rad.thumb }]}>
      <RadioIcon size={iconSize.control} color={colors.secondary} />
    </View>
  );
}

function StationEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: InternetRadioStation | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [name, setName] = useState(initial?.name ?? '');
  const [streamUrl, setStreamUrl] = useState(initial?.streamUrl ?? '');
  const [homepageUrl, setHomepageUrl] = useState(initial?.homepageUrl ?? '');

  const canSave = name.trim().length > 0 && /^https?:\/\//i.test(streamUrl.trim());

  const handleSave = useCallback(async () => {
    if (!api.radio) return false;
    try {
      const trimmedHomepage = homepageUrl.trim();
      if (initial) {
        // Sent even when empty — that is how clearing a homepage reaches the
        // server; see `updateInternetRadioStation`.
        await api.radio.update({
          id: initial.id,
          name: name.trim(),
          streamUrl: streamUrl.trim(),
          homepageUrl: trimmedHomepage,
        });
      } else {
        await api.radio.create({
          name: name.trim(),
          streamUrl: streamUrl.trim(),
          homepageUrl: trimmedHomepage || undefined,
        });
      }
      await onSaved();
      return true;
    } catch {
      notify.error(t('common.error.unexpected'));
      return false;
    }
  }, [api.radio, homepageUrl, initial, name, onSaved, streamUrl, t]);

  return (
    <FormSheet
      title={initial ? t('radio.editTitle') : t('radio.addTitle')}
      submitLabel={t('common.save')}
      canSubmit={canSave}
      onSubmit={handleSave}
      onClose={onClose}
    >
      <FormSheetField
        label={t('radio.field.name')}
        value={name}
        onChangeText={setName}
        placeholder="Radio Paradise"
      />
      <FormSheetField
        label={t('radio.field.streamUrl')}
        value={streamUrl}
        onChangeText={setStreamUrl}
        placeholder="https://stream.radioparadise.com/aac-320"
        autoCapitalize="none"
        keyboardType="url"
      />
      <FormSheetField
        label={t('radio.field.homepage')}
        value={homepageUrl}
        onChangeText={setHomepageUrl}
        placeholder="https://radioparadise.com"
        autoCapitalize="none"
        keyboardType="url"
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingVertical: spacing.md },
  // Inset to match `MediaListRow`'s own page padding, so the rule starts where
  // the row's content does rather than running to the screen edge.
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.page,
  },
  iconWrap: {
    width: controlSize.compactMediaRowArt,
    height: controlSize.compactMediaRowArt,
    alignItems: 'center',
    justifyContent: 'center',
    // A row with no cover gives its text no left margin, because the usual
    // such row has nothing in front of the text at all.
    marginRight: spacing.rowGap,
  },
  rowAction: { padding: spacing.xs },
});
