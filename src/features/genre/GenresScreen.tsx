import React, { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FlashList } from '@shopify/flash-list'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Tags } from 'lucide-react-native'

import { DetailHeaderBar } from '@/components/DetailHeader'
import EmptyState from '@/components/EmptyState'
import { useTheme } from '@/features/theme/useTheme'
import { iconSize, spacing, typography } from '@/constants/design'
import { useAlbums } from '@/features/album/useAlbums';
import { useGenres } from '@/features/genre/useGenres'
import { buildGenreRows, type GenreRow } from '@/features/genre/genreList'
import LoadingGenreList from './GenresLoading'
import Touchable from '@/components/Touchable'
import { useScrollClearance } from '@/features/theme/useScrollClearance'
import { useListDensity } from '@/features/theme/useListDensity'

const GenresScreen: React.FC = () => {
  const navigation = useNavigation<any>()
  const { t } = useTranslation()
  const scrollClearance = useScrollClearance()
  const { colors } = useTheme()
  const density = useListDensity()
  const { albums, isLoading } = useAlbums()
  const { genres } = useGenres()

  const rows = useMemo(() => buildGenreRows(genres, albums), [genres, albums])

  const renderItem = useCallback(({ item }: { item: GenreRow }) => (
    <Touchable
      testID="genres-item"
      accessibilityRole="button"
      accessibilityLabel={item.genre}
      style={[styles.row, { borderBottomColor: colors.border, paddingVertical: density.rowPadding }]}
      onPress={() => navigation.push('genreView', { genre: item.genre })}
    >
      <View style={styles.rowText}>
        <Text style={[styles.genre, { color: colors.secondary }]} numberOfLines={1}>
          {item.genre}
        </Text>
        <Text style={[styles.count, { color: colors.subtext }]}>
          {t('library.genres.albumCount', { count: item.albumCount })}
        </Text>
      </View>
      <ChevronRight size={iconSize.row} color={colors.subtext} />
    </Touchable>
  ), [colors, navigation, t, density.rowPadding])

  return (
    <SafeAreaView
      testID="genres-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {/* The bar names the screen; a heading under it would only say it
          again, which is the pattern every other list screen here follows. */}
      <DetailHeaderBar
        title={t('library.genres.title')}
        subtitle={rows.length > 0 ? t('library.count.genres', { count: rows.length }) : undefined}
      />
      {isLoading && rows.length === 0 ? (
        // Genres are counted from albums, so an unfinished album sync looks
        // exactly like a library with no genres.
        <LoadingGenreList />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Tags size={iconSize.emptyState} color={colors.subtext} />}
          message={t('library.genres.empty')}
        />
      ) : (
        <FlashList<GenreRow>
          data={rows}
          keyExtractor={item => item.genre}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: scrollClearance }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

export default GenresScreen

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0, marginRight: spacing.rowGap },
  genre: { ...typography.rowTitle },
  count: { ...typography.caption, marginTop: spacing.xxs },
})
