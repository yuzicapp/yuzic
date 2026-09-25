/**
 * The Search screen's one view model — every piece of state, effect, and
 * handler the screen needs, so `SearchScreen.tsx` itself is JSX plus styling.
 *
 * Owns the debounced query, the Library-XOR-Other-sources scope, the Filters
 * sheet selections, and the handlers that record/replay/navigate to a
 * result. Delegates *what* gets searched to `useSearch()`
 * (`src/features/search/SearchContext.tsx`) and *what gets recorded* to
 * `useSearchHistory` (`./searchHistory.ts`); this hook is the glue between
 * them and the screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import type { TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { type SearchResult, useSearch, type SearchEntityType } from '@/features/search/SearchContext';
import type { SearchResultScope } from '@/features/search/searchLegs';
import { ALL_SEARCH_ENTITY_TYPES } from '@/features/search/searchPolicy';
import { useSearchHistory } from '@/features/search/searchHistory';
import { entityToAlbum, entityToArtist } from '@/features/search/searchResultAdapters';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext';
import { notify } from '@/components/toast';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers';
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import { selectShowSourceHeaders } from '@/features/settings/appearance/state';
import { selectActiveServer, selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import type { SearchEntityEntry } from '@/state/redux/slices/searchHistorySlice';
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation';
import { useEnabledSearchSourceIds } from '@/features/sources/useSearchSourcesEnabled';
import { useAccountSheet } from '@/features/settings/AccountSheetContext';

export function useSearchScreenModel() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { navigateToAlbum, navigateToArtist } = useMatchedNavigation();
  const { playSong } = usePlayingActions();
  const { resolvePlayableSong } = usePlayableSongResolver();
  const { openSongOptions } = useSongActionSheets();
  const { openAccountSheet } = useAccountSheet();

  // Sources the user has turned on FOR SEARCH — independent of Home/discovery
  // enablement. Nothing here is ever implied by a Home toggle.
  const enabledSearchSourceIds = useEnabledSearchSourceIds();
  const showSourceHeaders = useSelector(selectShowSourceHeaders);
  const username = useSelector(selectActiveServer)?.username;
  const activeServerId = useSelector(selectActiveServerId);

  const history = useSearchHistory(activeServerId ?? undefined);
  const { searchResults, handleSearchWithFilters, clearSearch, isLoading, hasError, degraded } = useSearch();

  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  // 'library' is the default and the only scope that ever runs without an
  // explicit switch — "Other sources" is the deliberate external action.
  const [resultScope, setResultScope] = useState<SearchResultScope>('library');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(enabledSearchSourceIds);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<SearchEntityType[]>(ALL_SEARCH_ENTITY_TYPES);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `query` for the focus effect, which must not be re-created on every
  // keystroke but still needs to read the current value.
  const queryRef = useRef(query);
  queryRef.current = query;

  // Mirrors scope/filter selections for the same reason `queryRef` exists:
  // `runSearch` is stable across re-renders it doesn't need to react to, but
  // still has to read the current selection when the debounce/submit fires.
  const scopeRef = useRef(resultScope);
  scopeRef.current = resultScope;
  const selectedSourceIdsRef = useRef(selectedSourceIds);
  selectedSourceIdsRef.current = selectedSourceIds;
  const selectedEntityTypesRef = useRef(selectedEntityTypes);
  selectedEntityTypesRef.current = selectedEntityTypes;

  /**
   * Whether the field is focused — which decides what the idle screen shows.
   *
   * The tab used to force the keyboard open on arrival, on the theory that
   * arriving at Search means intending to type. Often it doesn't: it means
   * browsing, and half the screen was gone before anything had been looked at.
   * So the tab opens quietly now, and typing is a tap away like it is
   * everywhere else.
   *
   * Focus is what tells `SearchResultsBody` to put recent searches up. They
   * belong to the act of typing — a list of half-remembered past queries is
   * useful with a cursor in the field and clutter without one.
   */
  const searchInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const onSearchFocus = useCallback(() => setIsInputFocused(true), []);
  const onSearchBlur = useCallback(() => setIsInputFocused(false), []);

  // Leaving the tab ends the focused state whether or not the field gets a
  // blur event: navigating away from a focused field (tapping a browse tile,
  // say) unmounts nothing, so coming back would otherwise land on recents
  // with no keyboard to explain them.
  useFocusEffect(
    useCallback(() => {
      return () => setIsInputFocused(false);
    }, [])
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // A source that stops being enabled for search (disabled in Settings, or
  // the device going offline) drops out of the current selection too, so a
  // stale id never reaches `handleSearchWithFilters`. A newly-enabled source
  // is not auto-selected, so a user who narrowed the Filters sheet on purpose
  // doesn't have that choice silently widened out from under them — except
  // when it was switched on from that sheet, which selects it itself.
  useEffect(() => {
    setSelectedSourceIds(prev => {
      const next = prev.filter(id => enabledSearchSourceIds.includes(id as never));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledSearchSourceIds.join(',')]);

  const runSearch = useCallback((text: string) => {
    clearSearch();
    setHasSearched(true);
    void handleSearchWithFilters(text, {
      resultScope: scopeRef.current,
      sourceIds: selectedSourceIdsRef.current,
      entityTypes: selectedEntityTypesRef.current,
    });
  }, [clearSearch, handleSearchWithFilters]);

  // Switching scope (or the filters underneath "Other sources") re-runs the
  // current query immediately rather than waiting for the next keystroke —
  // otherwise flipping to "Other sources" would show stale library results
  // (or nothing) until the user typed again.
  useEffect(() => {
    if (query.trim() === '') return;
    runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultScope, selectedSourceIds.join(','), selectedEntityTypes.join(',')]);

  const onSearchChange = (text: string) => {
    setQuery(text);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!text.trim()) {
      clearSearch();
      setHasSearched(false);
      return;
    }
    typingTimeoutRef.current = setTimeout(() => runSearch(text), 300);
  };

  const clearQuery = () => {
    setQuery('');
    clearSearch();
    setHasSearched(false);
  };

  const onSearchSubmit = () => {
    Keyboard.dismiss();
    history.recordSearch(query);
  };

  const handleRecentPress = (value: string) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    Keyboard.dismiss();
    setQuery(value);
    runSearch(value);
    history.recordSearch(value);
  };

  const handleRecentSongPress = async (entity: SearchEntityEntry) => {
    try {
      const resolved = await resolvePlayableSong(entity.id);
      if (resolved) await playSong(resolved.song);
      else notify.error(t('common.playbackError'));
    } catch {
      notify.error(t('common.playbackError'));
    }
  };

  // Recent entities navigate straight to the item — no round-trip through search.
  const handleRecentEntityPress = (entity: SearchEntityEntry) => {
    Keyboard.dismiss();
    history.recordEntity(entity);

    if (entity.type === 'song') {
      void handleRecentSongPress(entity);
      return;
    }
    if (entity.type === 'album') {
      if (entity.source === 'external') navigateToAlbum(entityToAlbum(entity));
      else navigation.navigate('albumView', { id: entity.id });
      return;
    }
    if (entity.type === 'artist') {
      if (entity.source === 'external') navigateToArtist(entityToArtist(entity));
      else navigation.navigate('artistView', { id: entity.id });
      return;
    }
    navigation.navigate('playlistView', { id: entity.id });
  };

  /** Every result row calls this on selection, before its own navigation —
   *  the one place a result is recorded to history. */
  const selectResult = useCallback((result: SearchResult) => {
    history.recordResult(query, result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onSongPress = async (result: SearchResult) => {
    selectResult(result);
    try {
      // `SearchResult.song` is never populated for a library match any more
      // (it would need a credentialled stream URL nobody has asked for yet),
      // so this always resolves by id, same as any result that arrives
      // without one.
      const resolved = await resolvePlayableSong(result.id);
      if (resolved) await playSong(resolved.song);
      else notify.error(t('common.playbackError'));
    } catch {
      notify.error(t('common.playbackError'));
    }
  };

  const onSongOptions = async (result: SearchResult) => {
    try {
      const resolved = await resolvePlayableSong(result.id);
      if (resolved) openSongOptions(resolved.song);
      else notify.error(t('common.songDetailsError'));
    } catch {
      notify.error(t('common.songDetailsError'));
    }
  };

  // The library scope only ever contains local results, and "Other sources"
  // only ever contains external ones — `resultScope` already kept the fetch
  // itself from mixing the two (see `planSearchLegs`), and this keeps the
  // render from doing it either, belt and suspenders against a stray result
  // slipping in from a stale request.
  const isOtherScope = resultScope === 'other';
  const libraryResults = useMemo(
    () => (isOtherScope ? [] : searchResults.filter(r => r.source === 'local')),
    [searchResults, isOtherScope]
  );

  // Group external results by their source so each gets its own labelled,
  // provenance-tagged section — never merged into one undifferentiated list,
  // and never merged with the library results above.
  const externalResultsBySource = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    if (!isOtherScope) return groups;
    for (const r of searchResults) {
      if (r.source !== 'external' || !r.externalSource) continue;
      const existing = groups.get(r.externalSource);
      if (existing) existing.push(r);
      else groups.set(r.externalSource, [r]);
    }
    return groups;
  }, [searchResults, isOtherScope]);

  const coversToPrefetch = useMemo(() => searchResults.slice(0, 18).map(r => r.cover), [searchResults]);
  usePrefetchCovers(coversToPrefetch, 'thumb');

  const toggleFilterSource = useCallback((sourceId: string) => {
    setSelectedSourceIds(prev => prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId]);
  }, []);

  const toggleFilterEntityType = useCallback((entityType: SearchEntityType) => {
    setSelectedEntityTypes(prev => prev.includes(entityType) ? prev.filter(type => type !== entityType) : [...prev, entityType]);
  }, []);

  const noResultsForScope = query.trim() !== '' && hasSearched && !isLoading
    && (isOtherScope ? externalResultsBySource.size === 0 : libraryResults.length === 0);

  return {
    // navigation / identity
    navigation, navigateToAlbum, navigateToArtist, username, openAccountSheet,
    activeServerId: activeServerId ?? undefined,
    // query state
    query, onSearchChange, onSearchSubmit, clearQuery, searchInputRef,
    isInputFocused, onSearchFocus, onSearchBlur,
    // scope / filters
    resultScope, setResultScope, enabledSearchSourceIds,
    selectedSourceIds, selectedEntityTypes, toggleFilterSource, toggleFilterEntityType,
    isOtherScope, showSourceHeaders,
    // results
    hasSearched, isLoading, hasError, degraded,
    libraryResults, externalResultsBySource, noResultsForScope,
    // history
    recentQueries: history.recentQueries,
    recentEntities: history.recentEntities,
    onRecentQueryPress: handleRecentPress,
    onRecentEntityPress: handleRecentEntityPress,
    onRemoveRecent: history.removeEntry,
    onClearRecent: history.clear,
    // result actions
    selectResult, onSongPress, onSongOptions,
  };
}
