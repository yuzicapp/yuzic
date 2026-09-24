import React, { forwardRef, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/features/theme/useTheme'
import { renderBackdrop } from '@/components/BottomSheetBackdrop'
import { getSourceMeta } from '@/features/sources/registry'
import { MediaImage } from '@/components/MediaImage'
import type { SourceResolvedAlbum, SourceResolvedArtist } from '@/features/sources/registry'
import {
  OptionSheetDivider,
  OptionSheetSectionLabel,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives'
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { controlSize, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

type PickerItemAlbum = SourceResolvedAlbum & { kind: 'album' }
type PickerItemArtist = SourceResolvedArtist & { kind: 'artist' }
export type PickerItem = PickerItemAlbum | PickerItemArtist

type Props = {
  items: PickerItem[]
  isLoading?: boolean
  onSelect: (item: PickerItem) => void
}

const COVER_SIZE = 48

/** What a row says under its name: who made an album and when, or how to tell an artist from a namesake. */
function sublabelOf(item: PickerItem): string | undefined {
  if (item.kind === 'artist') return item.detail
  return [item.artist, item.year].filter(Boolean).join(' · ') || undefined
}

const ExternalSourcePickerSheet = forwardRef<BottomSheetModal, Props>(
  ({ items, isLoading, onSelect }, ref) => {
    const { t } = useTranslation()
    const { colors } = useTheme()
    const sheetBg = useOptionSheetBackground()
    const sheetContent = useOptionSheetContentStyle()
    const rad = useRadius()
    // Each source shows its best match; the rest wait behind a row, so the
    // sheet stays a choice between sources until a listener asks for more.
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
    useEffect(() => { setExpanded(new Set()) }, [items])

    const grouped = items.reduce<Record<string, PickerItem[]>>((acc, item) => {
      if (!acc[item.source]) acc[item.source] = []
      acc[item.source].push(item)
      return acc
    }, {})

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
        stackBehavior="push"
      >
        <BottomSheetScrollView style={sheetBg} contentContainerStyle={sheetContent}>
          {isLoading && (
            <View style={styles.loading}>
              <SpinningLoaderCircle size={iconSize.loader} color={colors.subtext} />
            </View>
          )}

          {!isLoading && items.length === 0 && (
            <Text style={[styles.empty, { color: colors.subtext }]}>
              {t('externalSourcePicker.empty')}
            </Text>
          )}

          {!isLoading && Object.entries(grouped).map(([sourceId, sourceItems], groupIndex) => {
            const meta = getSourceMeta(sourceId)
            const sourceLabel = meta?.label ?? sourceId
            const isExpanded = expanded.has(sourceId)
            const shown = isExpanded ? sourceItems : sourceItems.slice(0, 1)
            const hidden = sourceItems.length - shown.length
            return (
              <View key={sourceId}>
                {groupIndex > 0 && <OptionSheetDivider />}
                <OptionSheetSectionLabel label={sourceLabel} />
                {shown.map((item, i) => {
                  const label = item.kind === 'album' ? item.title : item.name
                  const sublabel = sublabelOf(item)
                  const isArtist = item.kind === 'artist'
                  return (
                    <Touchable
                      key={`${item.source}-${i}`}
                      style={styles.option}
                      onPress={() => onSelect(item)}
                    >
                      <MediaImage
                        cover={item.coverUrl ? { kind: 'url', url: item.coverUrl } : { kind: 'none' }}
                        size="thumb"
                        style={[styles.cover, { borderRadius: isArtist ? COVER_SIZE / 2 : rad.md }]}
                      />
                      <View style={styles.optionText}>
                        <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
                          {label}
                        </Text>
                        {sublabel && (
                          <Text style={[styles.artist, { color: colors.subtext }]} numberOfLines={1}>
                            {sublabel}
                          </Text>
                        )}
                      </View>
                    </Touchable>
                  )
                })}
                {hidden > 0 && (
                  <Touchable
                    style={styles.more}
                    onPress={() => setExpanded(prev => new Set(prev).add(sourceId))}
                  >
                    <Text style={[styles.moreText, { color: colors.subtext }]}>
                      {t('externalSourcePicker.moreMatches', { count: hidden })}
                    </Text>
                  </Touchable>
                )}
              </View>
            )
          })}
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  }
)

ExternalSourcePickerSheet.displayName = 'ExternalSourcePickerSheet'

export default ExternalSourcePickerSheet

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  empty: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.controlGap,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    marginRight: spacing.md,
  },
  optionText: {
    flex: 1,
  },
  more: {
    minHeight: controlSize.minimumTarget,
    justifyContent: 'center',
  },
  moreText: {
    ...typography.rowSubtitle,
    fontWeight: '600',
  },
  title: {
    ...typography.rowTitle,
  },
  artist: {
    ...typography.rowSubtitle,
    marginTop: spacing.xxs,
  },
})
