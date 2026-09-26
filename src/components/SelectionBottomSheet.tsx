import React, { forwardRef, useMemo, useState, useCallback } from 'react'
import { useIconSize } from '@/features/theme/useIconSize';
import { View, StyleSheet } from 'react-native'
import { Text } from '@/components/Text'
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { Dices } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/features/theme/useTheme'
import { renderBackdrop } from '@/components/BottomSheetBackdrop'
import Touchable from '@/components/Touchable'
import { hitSlopFor, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'

type Props = {
  items: string[]
  onSelect: (value: string) => void
  onRandomize: () => void
  placeholder?: string
}

const SelectionBottomSheet = forwardRef<BottomSheetModal, Props>(
  ({ items, onSelect, onRandomize, placeholder }, ref) => {
    const { t } = useTranslation()
    const icons = useIconSize();
    const { colors } = useTheme()
    const rad = useRadius()
    const [query, setQuery] = useState('')

    const snapPoints = useMemo(() => ['60%'], [])

    const filteredItems = useMemo(() => {
      const q = query.trim().toLowerCase()
      if (!q) return items
      return items.filter(item => item.toLowerCase().includes(q))
    }, [query, items])

    const handleDismiss = useCallback(() => {
      setQuery('')
    }, [])

    const handleSubmit = useCallback(() => {
      const trimmed = query.trim()
      if (trimmed) onSelect(trimmed)
    }, [query, onSelect])

    const renderItem = useCallback(({ item }: { item: string }) => (
      <Touchable
        style={[styles.item, { borderBottomColor: colors.muted }]}
        onPress={() => onSelect(item)}
      >
        <Text style={[styles.itemText, { color: colors.secondary }]}>
          {item}
        </Text>
      </Touchable>
    ), [onSelect, colors])

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: rad.md }]}>
          <BottomSheetTextInput
            style={[styles.input, { color: colors.secondary }]}
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder ?? t('common.searchPlaceholder')}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.selection.randomize')}
            onPress={onRandomize}
            style={styles.shuffleButton}
            hitSlop={hitSlopFor(icons.row)}
          >
            <Dices size={icons.row} color={colors.subtext} />
          </Touchable>
        </View>

        <BottomSheetFlatList
          data={filteredItems}
          keyExtractor={item => item}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </BottomSheetModal>
    )
  }
)

SelectionBottomSheet.displayName = 'SelectionBottomSheet'
export default SelectionBottomSheet

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  input: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  shuffleButton: {
    paddingLeft: spacing.controlGap,
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    ...typography.body,
  },
})
