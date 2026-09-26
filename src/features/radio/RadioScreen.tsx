import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { notify } from '@/components/toast';
import { ArrowDownAZ, CloudOff, Ellipsis, ListOrdered, Radio as RadioIcon } from 'lucide-react-native';

import { useApi } from '@/providers/registry/useApi';
import type { InternetRadioStation } from '@/providers/contracts/ServerAdapter';
import { stationCover, stationToSong } from '@/features/radio/buildStationSong';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { DetailHeaderBar, DetailHeaderIconButton } from '@/components/DetailHeader';
import StationEditor from './StationEditor';
import { RadioListOptions, RadioStationOptions } from '@/components/options/RadioOptions';
import MediaListRow from '@/components/MediaListRow';
import ListControls from '@/components/ListControls';
import SingleSelectBottomSheet, { type SingleSelectOption } from '@/components/SingleSelectBottomSheet';
import { useSheetRef } from '@/components/useSheetRef';
import LibraryItem from '@/features/library/components/Items/LibraryItem';
import { gridItemWidth, libraryGutter, GRID_SPACING } from '@/features/library/layout';
import { useGridColumns } from '@/features/layout/useGridColumns';
import {
  selectLibraryViewMode,
  setLibraryViewMode,
} from '@/features/settings/appearance/state';
import Touchable from '@/components/Touchable';
import EmptyState from '@/components/EmptyState';
import SkeletonListRow from '@/components/SkeletonListRow';
import { controlSize, hitSlopFor, iconSize, spacing } from '@/constants/design';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import haptics from '@/components/haptics';

type Editing =
  | { mode: 'add' }
  | { mode: 'edit'; station: InternetRadioStation };

/**
 * How the stations are ordered.
 *
 * `serverOrder` is the order the server returned them in — which is the one
 * the user arranged, so it is the default and it is named rather than being
 * an unlabelled "no sort".
 */
type StationSort = 'serverOrder' | 'title';

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
  const icons = useIconSize();
  const api = useApi();
  const queryClient = useQueryClient();
  const serverReachable = useServerReachable();
  const scrollClearance = useScrollClearance();
  const { playSong } = usePlayingActions();
  const activeServer = useSelector(selectActiveServer);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [optionsFor, setOptionsFor] = useState<InternetRadioStation | null>(null);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [sort, setSort] = useState<StationSort>('serverOrder');
  const dispatch = useDispatch();
  const isGridView = useSelector(selectLibraryViewMode('radio'));
  const gridColumns = useGridColumns();
  const { width: screenWidth } = useWindowDimensions();
  const sortSheetRef = useSheetRef();

  const gutter = libraryGutter(isGridView, GRID_SPACING, screenWidth);
  const gridWidth = gridItemWidth(screenWidth, gridColumns, GRID_SPACING, gutter);

  const stationsQuery = useQuery({
    queryKey: [QueryKeys.Radio],
    queryFn: async () => (await api.radio?.list()) ?? [],
    enabled: Boolean(api.radio) && serverReachable,
    staleTime: 1000 * 60 * 5,
  });

  /**
   * The stations as they will be drawn.
   *
   * Sorted into a copy — the query cache hands back its own array, and
   * ordering it in place would reorder what every other reader sees.
   */
  const stations = useMemo(() => {
    const list = stationsQuery.data ?? [];
    return sort === 'title'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : list;
  }, [stationsQuery.data, sort]);

  const sortOptions = useMemo<SingleSelectOption[]>(() => [
    { value: 'serverOrder', label: t('radio.sort.serverOrder'), Icon: ListOrdered },
    { value: 'title', label: t('home.sort.alphabetical'), Icon: ArrowDownAZ },
  ], [t]);

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
      isGridView ? (
        // A grid earns its place now that a station can have a logo: it is
        // artwork to scan. The ones no directory had a logo for fall back to
        // the radio mark, which still reads as a station rather than as a
        // failure.
        <LibraryItem
          testID="radio-station-tile"
          cover={stationCover(item)}
          title={item.name}
          isGridView
          gridWidth={gridWidth}
          gridSpacing={GRID_SPACING}
          onPress={() => handlePlay(item)}
          onLongPress={() => setOptionsFor(item)}
        />
      ) : (
        <MediaListRow
          testID="radio-station-row"
          title={item.name}
          subtitle={item.homepageUrl || item.streamUrl}
          // The station's own logo where the directory has one, the radio mark
          // where it doesn't — either way a real cover, drawn like every other
          // row's, rather than a glyph standing in for artwork.
          cover={stationCover(item)}
          variant="compact"
          onPress={() => handlePlay(item)}
          trailing={
            <Touchable
              testID="radio-station-options"
              onPress={() => setOptionsFor(item)}
              hitSlop={hitSlopFor(icons.row)}
              style={styles.rowAction}
              feedback="control"
              accessibilityRole="button"
              accessibilityLabel={t('a11y.rows.options', { title: item.name })}
            >
              <Ellipsis size={icons.row} color={colors.subtext} />
            </Touchable>
          }
        />
      )
    ),
    [handlePlay, colors.subtext, t, isGridView, gridWidth, icons]
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
          // Changing the column count needs a new list; FlatList keeps the
          // old layout otherwise.
          key={isGridView ? `grid-${gridColumns}` : 'list'}
          data={stations}
          keyExtractor={(s) => s.id}
          numColumns={isGridView ? gridColumns : 1}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: gutter, paddingBottom: scrollClearance },
          ]}
          // A rule between rows separates them; between grid cells it would
          // cut across the artwork.
          ItemSeparatorComponent={isGridView ? undefined : renderSeparator}
          ListHeaderComponent={
            // The gutter is sized for the items; the controls above them keep
            // the app's own page inset, so give that back before it is
            // applied twice.
            <View style={{ marginHorizontal: -gutter }}>
              <ListControls
                sortLabel={sort === 'title' ? t('home.sort.alphabetical') : t('radio.sort.serverOrder')}
                onSortPress={() => sortSheetRef.current?.present()}
                isGridView={isGridView}
                onToggleView={() => dispatch(
                  setLibraryViewMode({ collection: 'radio', isGridView: !isGridView })
                )}
              />
            </View>
          }
          renderItem={renderStation}
        />
      )}

      <SingleSelectBottomSheet
        ref={sortSheetRef}
        testID="radio-sort-sheet"
        selected={sort}
        options={sortOptions}
        title={t('home.sortSheet.title')}
        // Dismissed here rather than left up: the sheet asked one question and
        // has its answer, and the list it reorders is behind it.
        onSelect={value => {
          setSort(value as StationSort);
          sortSheetRef.current?.dismiss();
        }}
      />

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
  rowAction: { padding: spacing.xs },
});
