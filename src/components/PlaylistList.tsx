import { hitSlopFor, iconSize, onDark, spacing, stateLayer, typography } from '@/constants/design';
import React, {
  useCallback,
  useState,
  forwardRef,
  useMemo,
} from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Text } from '@/components/Text';
import {
  BottomSheetModal,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { X, Search, Plus, Check } from 'lucide-react-native';
import { notify } from '@/components/toast';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { MediaImage } from './MediaImage';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaylists } from '@/features/playlist/usePlaylists';
import { useCreatePlaylist } from '@/features/playlist/useCreatePlaylist';
import { useAddSongToPlaylist } from '@/features/playlist/useAddSongToPlaylist';
import { usePlaylistMembership } from '@/features/playlist/usePlaylistMembership';
import { useRemoveSongFromPlaylist } from '@/features/playlist/useRemoveSongFromPlaylist';
import { useTranslation } from 'react-i18next';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { FAVORITES_ID } from '@/constants/favorites';
import { canEditPlaylist } from '@/features/entity-actions/registry/playlistActions';

type PlaylistListProps = {
  selectedSong: Song | null;
  onClose: () => void;
};

const PlaylistList = forwardRef<BottomSheetModal, PlaylistListProps>(
  ({ selectedSong, onClose }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
  const icons = useIconSize();
    const rad = useRadius();
    const isOffline = useIsOffline();
    const themeColor = colors.themeColor;
    const insets = useSafeAreaInsets();

    const { playlists: allPlaylists } = usePlaylists();
    // Favorites is a synthetic playlist backed by starred songs: toggling it
    // here would call the same star/unstar as the heart button already on the
    // song, so it's redundant in the add-to-playlist chooser. It stays a
    // browsable collection in the Library; it just isn't a target you pick.
    const playlists = useMemo(
      // FAVORITES_ID is the synthetic playlist's id at the origin, so the
      // comparison is against nativeId rather than on-device identity. A
      // playlist this account may not change is no place to add a song to:
      // another account's public playlist was offered here, and the server
      // refused the add.
      () => allPlaylists.filter(p => p.nativeId !== FAVORITES_ID && canEditPlaylist(p)),
      [allPlaylists]
    );
    const createPlaylist = useCreatePlaylist();
    const addSongToPlaylist = useAddSongToPlaylist();
    const removeSongFromPlaylist = useRemoveSongFromPlaylist();

    const [searchQuery, setSearchQuery] = useState('');
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const {
      selectedIds,
      baseSelectedIds,
      loading: membershipLoading,
      toggle: togglePlaylist,
    } = usePlaylistMembership(selectedSong, playlists, isSheetOpen);

    const snapPoints = useMemo(() => ['85%'], []);

    const filteredPlaylists = useMemo(
      () =>
        playlists.filter(p =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      [playlists, searchQuery]
    );

    const renderPlaylistItem = useCallback(({ item }: { item: Playlist }) => {
      const isChecked = selectedIds.has(item.nativeId);

      return (
        <Touchable
          style={styles.option}
          disabled={membershipLoading}
          onPress={() => togglePlaylist(item.nativeId)}
        >
          <MediaImage
            cover={item.cover ?? { kind: 'none' }}
            size="thumb"
            style={[styles.playlistCover, { borderRadius: rad.thumb }]}
          />

          <Text style={[styles.optionText, { color: colors.secondary }]}>
            {item.title}
          </Text>

          <Check
            size={iconSize.header}
            color={themeColor}
            style={{ opacity: isChecked ? 1 : 0 }}
          />
        </Touchable>
      );
    }, [selectedIds, membershipLoading, togglePlaylist, colors.secondary, themeColor, rad.thumb]);

    const handleCreatePlaylist = async () => {
      if (!newPlaylistName.trim()) return;
      try {
        await createPlaylist.mutateAsync(newPlaylistName.trim());
        setNewPlaylistName('');
      } catch (e) {
        if (e instanceof Error && e.message === 'offline') {
          notify.error(t('common.offline.notAvailable'));
        } else {
          notify.error(t('playlistList.createFailed'));
        }
      }
    };

    const handleDone = async () => {
      if (!selectedSong) return;
      const wasOffline = isOffline;

      const mutations: Promise<unknown>[] = [];
      for (const playlist of playlists) {
        const wasIn = baseSelectedIds.has(playlist.nativeId);
        const isIn = selectedIds.has(playlist.nativeId);

        if (isIn && !wasIn) {
          mutations.push(addSongToPlaylist.mutateAsync({
            playlistId: playlist.nativeId,
            song: selectedSong,
          }));
        } else if (!isIn && wasIn) {
          mutations.push(removeSongFromPlaylist.mutateAsync({
            playlistId: playlist.nativeId,
            songId: selectedSong.nativeId,
          }));
        }
      }

      const results = await Promise.allSettled(mutations);
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        notify.error(t('playlistList.updateFailed'));
      } else {
        notify.success(t(wasOffline ? 'playlistList.updatedOffline' : 'playlistList.updated'));
        onClose();
      }
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        onDismiss={onClose}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        stackBehavior="push"
        handleComponent={null}
        onChange={(index) => setIsSheetOpen(index >= 0)}
        backgroundStyle={{ backgroundColor: colors.card }}
      >
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.common.close')}
            onPress={onClose}
            style={styles.cancelButton}
            hitSlop={hitSlopFor(32)}
          >
            <X size={iconSize.control} color={colors.secondary} strokeWidth={2.5} />
          </Touchable>

          <Text style={[styles.headerTitle, { color: colors.secondary }]}>
            {t('playlistList.title')}
          </Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.searchContainer, { backgroundColor: colors.muted, borderRadius: rad.md }]}>
            <Search size={iconSize.control} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: colors.secondary }]}
              placeholder={t('playlistList.searchPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.createContainer}>
            <TextInput
              style={[styles.newPlaylistInput, { backgroundColor: colors.muted, color: colors.secondary, borderRadius: rad.md }]}
              placeholder={t('playlistList.newPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={t('a11y.playlist.create')}
              onPress={handleCreatePlaylist}
            >
              <Plus size={iconSize.loader} color={colors.secondary} />
            </Touchable>
          </View>

          <BottomSheetFlatList
            data={filteredPlaylists}
            keyExtractor={item => item.localId}
            contentContainerStyle={{ paddingBottom: spacing.scrollClearance }}
            extraData={selectedIds}
            renderItem={renderPlaylistItem}
          />
        </View>

        <View
          style={[
            styles.doneWrapper,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Touchable
            style={[
              styles.doneButton,
              { backgroundColor: themeColor, borderRadius: rad.card },
              membershipLoading && styles.doneButtonDisabled,
            ]}
            disabled={membershipLoading}
            onPress={handleDone}
          >
            {membershipLoading ? (
              <SpinningLoaderCircle size={icons.row} color={onDark.text} />
            ) : (
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            )}
          </Touchable>
        </View>
      </BottomSheetModal>
    );
  }
);

PlaylistList.displayName = 'PlaylistList';

export default PlaylistList;

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelButton: {
    position: 'absolute',
    left: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.rowTitle,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.controlGap,
    marginBottom: spacing.lg,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  createContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  newPlaylistInput: {
    ...typography.body,
    flex: 1,
    padding: spacing.controlGap,
    marginRight: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.controlGap,
  },
  playlistCover: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  doneWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: 'transparent',
  },
  doneButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    opacity: stateLayer.secondaryContentOpacity,
  },
  doneButtonText: {
    ...typography.rowTitle,
    color: onDark.text,
  },
});
