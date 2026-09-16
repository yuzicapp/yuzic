import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Search } from 'lucide-react-native';

import { DetailHeaderBar } from '@/components/DetailHeader';
import EmptyState from '@/components/EmptyState';
import { WantOptions } from '@/components/options/WantOptions';
import { useTheme } from '@/features/theme/useTheme';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation';
import { iconSize } from '@/constants/design';
import { selectWantsForActiveServer } from '@/state/redux/selectors/wantsSelectors';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { removeWant, type Want } from '@/state/redux/slices/wantsSlice';
import WantRow from './WantRow';
import WantGetSheet from './WantGetSheet';
import { useWantRowStatus } from './useWantRowStatus';
import { wantAlbum, wantArtist } from './wantEntity';

/**
 * Wants: the things you have decided you want and do not have.
 *
 * Every row is live. Its artwork resolves through the app's one picture rule,
 * it opens the catalogue screen for what it names, and — where a downloader
 * is connected and has been asked — it says what that downloader is doing
 * with it. None of which was true of the save-only list this replaces: a
 * title, an artist, a placeholder square and an "×".
 *
 * What it still does not do is acquire anything on its own. A want is an
 * intent, and turning one into a download takes a Get from the row's own "…"
 * and the confirm tap behind it. Nothing on this screen starts a job, and
 * nothing off it does either.
 *
 * Wants are created by saving a *resolved* result — from Search, or a song's,
 * album's or artist's options — so this screen has no add control of its own.
 * The empty state points at Search, the one place a want is born with real
 * metadata; a free-text "type a title" box would only manufacture unmatchable
 * rows.
 */
const WantsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const scrollClearance = useScrollClearance();
  const wants = useSelector(selectWantsForActiveServer);
  const activeServerId = useSelector(selectActiveServerId);
  const statusOf = useWantRowStatus();
  const { navigateToAlbum, navigateToArtist } = useMatchedNavigation();
  const [optionsFor, setOptionsFor] = useState<Want | null>(null);
  const [getFor, setGetFor] = useState<Want | null>(null);

  const handleRemove = useCallback((want: Want) => {
    if (!activeServerId) return;
    dispatch(removeWant({ serverId: activeServerId, localId: want.localId }));
  }, [dispatch, activeServerId]);

  const goToSearch = useCallback(() => {
    router.navigate('/(home)/(tabs)/(search)');
  }, [router]);

  /**
   * Open what the want names, through the app's one external-resolution
   * path: it lands on the library's own copy where there is one, resolves
   * across every enabled source otherwise, and asks which when more than one
   * answers. A track opens the record it is on — a library track has no
   * screen of its own, and the album is the thing you came to look at.
   */
  const open = useCallback((want: Want) => {
    if (want.unit === 'artist') navigateToArtist(wantArtist(want));
    else navigateToAlbum(wantAlbum(want));
  }, [navigateToAlbum, navigateToArtist]);

  const renderItem = useCallback(
    ({ item }: { item: Want }) => (
      <WantRow
        want={item}
        status={statusOf(item)}
        onPress={() => open(item)}
        onOptions={() => setOptionsFor(item)}
      />
    ),
    [statusOf, open]
  );

  return (
    <SafeAreaView testID="wants-screen" edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <DetailHeaderBar
        title={t('wants.title')}
        subtitle={wants.length > 0 ? t('library.count.items', { count: wants.length }) : undefined}
      />
      {wants.length === 0 ? (
        <EmptyState
          icon={<Search size={iconSize.emptyState} color={colors.subtext} />}
          message={t('wants.empty')}
          action={{ label: t('wants.searchAction'), onPress: goToSearch }}
        />
      ) : (
        <FlatList
          data={wants}
          keyExtractor={(item) => item.localId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: scrollClearance }}
        />
      )}

      {optionsFor && (
        <WantOptions
          want={optionsFor}
          status={statusOf(optionsFor)}
          onClose={() => setOptionsFor(null)}
          onOpen={() => open(optionsFor)}
          onGet={() => setGetFor(optionsFor)}
          onSearch={goToSearch}
          onRemove={() => handleRemove(optionsFor)}
        />
      )}

      {/* Album and track Gets go through the app's normal review sheet; an
          artist Get is dispatched from the options sheet itself, since there
          is no release to review. */}
      {getFor && getFor.unit !== 'artist' && (
        <WantGetSheet want={getFor} onClose={() => setGetFor(null)} />
      )}
    </SafeAreaView>
  );
};

export default WantsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
