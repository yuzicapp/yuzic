import React, { useMemo } from 'react'
import { useIconSize } from '@/features/theme/useIconSize';
import { StyleSheet, View } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CloudOff } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/features/theme/useTheme'
import { useAlbums } from '@/features/album/useAlbums';
import { albumsByGenre } from '@/features/library/catalogStore'
import { useCatalogStore } from '@/features/library/useCatalogStore'
import NotFoundView from '@/components/NotFoundView'
import StatusBanner from '@/components/StatusBanner'
import GenreContent from './components/Content'
import LoadingGenreContent from './components/Content/Loading'
import { DETAIL_BAR_HEIGHT } from '@/components/DetailHeader'
import { spacing } from '@/constants/design'

const GenreScreen: React.FC = () => {
  const route = useRoute<any>()
  const { genre } = route.params
  const { t } = useTranslation()
  const icons = useIconSize();
  const { colors } = useTheme()
  // Still the source of the load and reachability state; the list itself comes
  // from the store below.
  const { isLoading, degraded } = useAlbums()
  const store = useCatalogStore()
  const insets = useSafeAreaInsets()

  // This used to scan every album in the library on every render. Genre is
  // indexed once for the app now, so this is a lookup.
  const genreAlbums = useMemo(() => albumsByGenre(store, genre), [store, genre])

  if (!genre) {
    return <NotFoundView message={t('media.genreNotFound')} />
  }

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadingGenreContent />
      </SafeAreaView>
    )
  }

  return (
    <View testID="genre-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
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
      <GenreContent genre={genre} albums={genreAlbums} />
    </View>
  )
}

export default GenreScreen

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
})
