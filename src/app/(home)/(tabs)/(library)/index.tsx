import React, { useRef } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenBackground } from '@/features/theme/ScreenBackground'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useScrollToTop } from '@react-navigation/native'

import { useTheme } from '@/features/theme/useTheme'
import { useAccountSheet } from '@/features/settings/AccountSheetContext'
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors'
import { useServerReachable } from '@/features/connectivity/useServerReachable'

import TabHeader from '@/components/TabHeader'
import StatusBanner from '@/components/StatusBanner'
import LibraryEntryRows from '@/features/library/LibraryEntryRows'
import { useScrollClearance } from '@/features/theme/useScrollClearance'
import { iconSize, spacing } from '@/constants/design'
import { CloudOff } from 'lucide-react-native'

/**
 * The library index: one entry point per way of browsing the collection.
 *
 * Nothing else. It used to carry a "Recently added" grid under the rows, which
 * duplicated Home's shelf of the same albums and read as a feed pinned to the
 * bottom of a menu. Recency is now one of the rows, so the complete list is
 * still a tap away and this screen stays what it is: a stable, exhaustive index
 * where Home is the changing one.
 *
 * The rows render immediately, mid-sync included — they are the way into every
 * other screen and cost nothing to show.
 */
export default function LibraryScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const scrollClearance = useScrollClearance()
  const activeServer = useSelector(selectActiveServer)
  const username = activeServer?.username
  const { openAccountSheet } = useAccountSheet()
  const serverReachable = useServerReachable()

  const scrollRef = useRef<ScrollView>(null)
  useScrollToTop(scrollRef)

  return (
    <SafeAreaView
      testID="library-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenBackground screen="library" />
      <TabHeader
        title={t('library.title')}
        username={username}
        onAccountPress={openAccountSheet}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: scrollClearance }}
        showsVerticalScrollIndicator={false}
      >
        {!serverReachable && (
          <StatusBanner
            icon={<CloudOff size={iconSize.badge} color={colors.subtext} />}
            text={t('library.offlineBanner')}
            style={styles.offlineBanner}
            testID="library-offline-banner"
          />
        )}
        <LibraryEntryRows />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  offlineBanner: {
    marginHorizontal: spacing.page,
    marginBottom: spacing.sm,
  },
})
