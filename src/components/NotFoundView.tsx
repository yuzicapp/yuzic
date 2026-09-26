import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from '@/components/Text'
import { ChevronLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/features/theme/useTheme'
import Touchable from '@/components/Touchable'
import { iconSize, spacing, typography } from '@/constants/design'

type Props = {
  message?: string
}

export default function NotFoundView({ message }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors } = useTheme()
  // Defaulted here rather than in the signature so the fallback is translated
  // too — a default parameter can't reach `t`.
  const text = message ?? t('media.notFound')

  // A cold deep link to something that does not exist has nothing behind it to
  // pop, which would strand the reader here with a dead back arrow — the same
  // case the settings header handles, for the same reason.
  const handleBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(home)/(tabs)/(home)')
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.common.back')}
          onPress={handleBack}
          style={styles.headerButton}
        >
          <ChevronLeft size={iconSize.header} color={colors.secondary} />
        </Touchable>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.message, { color: colors.secondary }]}>{text}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    padding: spacing.tight,
  },
  headerSpacer: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.generous,
    paddingHorizontal: spacing.xxl,
  },
  message: {
    ...typography.rowTitle,
  },
})
