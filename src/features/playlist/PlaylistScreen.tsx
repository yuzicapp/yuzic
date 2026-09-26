import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { usePlaylistScreenModel, type PlaylistRouteParams, type PlaylistScreenModel } from '@/features/playlist/usePlaylistScreenModel';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import NotFoundView from '@/components/NotFoundView';
import StatusBanner from '@/components/StatusBanner';

import PlaylistContent from './components/Content';
import LoadingPlaylistContent from './components/Content/Loading';
import { DETAIL_BAR_HEIGHT } from '@/components/DetailHeader'
import { spacing } from '@/constants/design';

const PlaylistScreen: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params as PlaylistRouteParams;

  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const model: PlaylistScreenModel = usePlaylistScreenModel({ id });
  const { playlist, songs, status, songsLoading, degraded } = model;
  const insets = useSafeAreaInsets();

  if (status === 'loading') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadingPlaylistContent />
      </SafeAreaView>
    );
  }

  if (!playlist) {
    return (
      <NotFoundView
        message={status === 'error' ? t('media.playlistLoadFailed') : t('media.playlistNotFound')}
      />
    );
  }

  return (
    <View testID="playlist-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      {degraded && (
        <View
          pointerEvents="box-none"
          style={[styles.degradedBanner, { top: insets.top + DETAIL_BAR_HEIGHT }]}
        >
          <StatusBanner
            icon={<CloudOff size={icons.badge} color={colors.subtext} />}
            text={t('common.serverUnreachableBanner')}
            closable
            testID="server-unreachable-banner"
          />
        </View>
      )}
      <PlaylistContent playlist={playlist} songs={songs} songsLoading={songsLoading} />
    </View>
  );
};

export default PlaylistScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Under the floating bar rather than above the content: the art runs to the
  // top of the screen now, and there is nowhere above it left to push.
  degradedBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
});
