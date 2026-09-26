/**
 * The album screen's entry point: resolves the route into one
 * `AlbumScreenModel` (`useAlbumScreenModel.ts`) and renders the
 * loading/not-found/degraded states around it, handing the ready model to
 * `AlbumContent` for the rest of the render.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import NotFoundView from '@/components/NotFoundView';
import StatusBanner from '@/components/StatusBanner';

import AlbumContent from '@/features/album/components/Content';
import LoadingAlbumContent from '@/features/album/components/Content/Loading';
import { DETAIL_BAR_HEIGHT } from '@/components/DetailHeader';
import { spacing } from '@/constants/design';
import { useAlbumScreenModel, type AlbumRouteParams } from './useAlbumScreenModel';

const AlbumScreen: React.FC = () => {
  const route = useRoute<any>();
  const params = (route.params ?? {}) as AlbumRouteParams;

  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const insets = useSafeAreaInsets();

  const model = useAlbumScreenModel(params);

  if (model.status === 'loading') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadingAlbumContent />
      </SafeAreaView>
    );
  }

  if (model.status === 'not-found' || model.status === 'error') {
    const message = t(model.status === 'error' ? 'media.albumLoadFailed' : 'media.albumNotFound');
    return <NotFoundView message={message} />;
  }

  return (
    <View testID="album-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      {model.degraded && (
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
      <AlbumContent model={model} />
    </View>
  );
};

export default AlbumScreen;

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
