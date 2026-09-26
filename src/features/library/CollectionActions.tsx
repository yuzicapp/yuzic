import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { Play, Shuffle } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/features/theme/useTheme'
import { controlSize, iconSize, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'
import Touchable from '@/components/Touchable'

type Props = {
  onPlay: () => void
  onShuffle: () => void
}

/**
 * Play and shuffle for a whole collection.
 *
 * Deliberately not the circle-and-pill pair from `DetailHeader`: that shape
 * belongs to a screen led by a piece of artwork, where the buttons sit centred
 * under the cover. A collection has no artwork to sit under, so the actions
 * carry the top of the screen themselves — two square-shouldered halves of the
 * full content width.
 */
const CollectionActions: React.FC<Props> = ({ onPlay, onShuffle }) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()

  return (
    <View style={styles.row}>
      <Touchable
        testID="collection-play"
        style={[styles.button, { backgroundColor: colors.themeColor, borderRadius: rad.md }]}
        onPress={onPlay}
        accessibilityRole="button"
      >
        <Play size={iconSize.row} color={colors.onThemeColor} fill={colors.onThemeColor} />
        <Text style={[styles.label, { color: colors.onThemeColor }]}>
          {t('common.play')}
        </Text>
      </Touchable>

      <Touchable
        testID="collection-shuffle"
        style={[styles.button, { backgroundColor: colors.muted, borderRadius: rad.md }]}
        onPress={onShuffle}
        accessibilityRole="button"
      >
        <Shuffle size={iconSize.row} color={colors.secondary} />
        <Text style={[styles.label, { color: colors.secondary }]}>
          {t('common.shuffle')}
        </Text>
      </Touchable>
    </View>
  )
}

export default CollectionActions

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.controlGap },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.inlineGap,
    height: controlSize.detailPrimaryHeight,
  },
  label: { ...typography.button },
})
