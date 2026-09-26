import React from 'react'
import { useIconSize } from '@/features/theme/useIconSize';
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { useNavigation } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  Disc3,
  ArrowDownToLine,
  Download,
  Heart,
  Link2,
  ListMusic,
  Music2,
  Podcast,
  Radio,
  Tags,
  Users,
} from 'lucide-react-native'

import { useApi } from '@/providers/registry/useApi'
import { useServerSurface } from './useServerSurface'
import { useTheme } from '@/features/theme/useTheme'
import { useListDensity } from '@/features/theme/useListDensity'
import { spacing, typography } from '@/constants/design'
import CoverMosaic from './CoverMosaic'
import { useLibrarySummary, type LibraryEntryKey } from './useLibrarySummary'
import type { LibraryCollectionType } from './librarySort'
import Touchable from '@/components/Touchable'

/** Big enough for four covers to still be covers, and the row's height with it. */
const MOSAIC_SIZE = 56

type Entry = {
  key: LibraryEntryKey
  labelKey: string
  icon: React.ReactNode
  onPress: () => void
}

type Section = {
  key: string
  labelKey: string
  entries: Entry[]
}

/**
 * The library's browse entry points.
 *
 * Two groups, because the rows are two different kinds of thing: the first is
 * what the library *is* — one row per kind of thing in it — and the second
 * cuts across those kinds. A flat list made "Genres" look like a sibling of
 * "Albums" and "Downloaded" look like a sibling of "Tracks", when only one of
 * those pairs is true.
 *
 * Each opens a screen of its own rather than filtering a list here, so the set
 * can grow without a row of filters growing with it — which is how genres went
 * so long with no way in.
 *
 * A time-ordered view of albums ("recently added") is not a row here: it is
 * the Albums row with its default sort. Adding "recently added" would beg the
 * question of why "most played" isn't a row too, when both are the same shape
 * of thing — a sort order over what you already own — and belong in the sort
 * sheet. The changing view of it still lives on Home.
 */
const LibraryEntryRows: React.FC = () => {
  const navigation = useNavigation<any>()
  const router = useRouter()
  const icons = useIconSize();
  const { t } = useTranslation()
  const { colors } = useTheme()
  // The library's own density step, the same one LibraryItem uses. Without it
  // half the rows on this screen moved with the setting and half held still.
  const density = useListDensity()
  const summary = useLibrarySummary()
  const api = useApi()
  const podcastsOffered = useServerSurface('podcasts')
  const sharesOffered = useServerSurface('shares')

  const openCollection = (type: LibraryCollectionType) =>
    navigation.push('libraryCollectionView', { type })

  const size = 20
  const color = colors.subtext

  // Provider-only surfaces stay out of the list on servers that can't back
  // them — a Jellyfin user should never see a Radio row that goes nowhere.
  // Podcasts and shares also wait for the server to confirm it has them: a
  // protocol can declare endpoints a given server never implemented.
  const browseEntries: Entry[] = [
    {
      key: 'genres',
      labelKey: 'library.genres.title',
      icon: <Tags size={size} color={color} />,
      onPress: () => navigation.push('genresView'),
    },
    {
      key: 'downloaded',
      labelKey: 'home.filters.downloaded',
      icon: <ArrowDownToLine size={size} color={color} />,
      // The same collection screen as Albums or Tracks, so saved music opens
      // and plays from here. Storage management is one tap further, from its
      // header, rather than being the whole screen.
      onPress: () => openCollection('downloaded'),
    },
    {
      key: 'downloads',
      labelKey: 'library.downloads.title',
      icon: <Download size={size} color={color} />,
      onPress: () => router.push('/downloadsView'),
    },
    {
      key: 'wants',
      labelKey: 'library.wants.title',
      icon: <Heart size={size} color={color} />,
      onPress: () => router.push('/wantsView'),
    },
  ]
  if (api.radio) {
    browseEntries.push({
      key: 'radio',
      labelKey: 'library.radio.title',
      icon: <Radio size={size} color={color} />,
      onPress: () => navigation.push('radio'),
    })
  }
  if (podcastsOffered) {
    browseEntries.push({
      key: 'podcasts',
      labelKey: 'library.podcasts.title',
      icon: <Podcast size={size} color={color} />,
      onPress: () => navigation.push('podcasts'),
    })
  }
  if (sharesOffered) {
    browseEntries.push({
      key: 'shares',
      labelKey: 'library.shares.title',
      icon: <Link2 size={size} color={color} />,
      onPress: () => navigation.push('shares'),
    })
  }

  const sections: Section[] = [
    {
      key: 'collection',
      labelKey: 'library.sections.collection',
      entries: [
        {
          key: 'playlists',
          labelKey: 'home.filters.playlists',
          icon: <ListMusic size={size} color={color} />,
          onPress: () => openCollection('playlists'),
        },
        {
          key: 'albums',
          labelKey: 'home.filters.albums',
          icon: <Disc3 size={size} color={color} />,
          onPress: () => openCollection('albums'),
        },
        {
          key: 'artists',
          labelKey: 'home.filters.artists',
          icon: <Users size={size} color={color} />,
          onPress: () => openCollection('artists'),
        },
        {
          key: 'tracks',
          labelKey: 'home.filters.tracks',
          icon: <Music2 size={size} color={color} />,
          onPress: () => openCollection('tracks'),
        },
      ],
    },
    {
      key: 'browse',
      labelKey: 'library.sections.browse',
      entries: browseEntries,
    },
  ]

  return (
    <View>
      {sections.map(section => (
        <View key={section.key}>
          <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
            {t(section.labelKey)}
          </Text>

          {section.entries.map((entry, index) => {
            const { count, covers } = summary[entry.key]
            return (
              <Touchable
                key={entry.key}
                testID={`library-entry-${entry.key}`}
                accessibilityRole="button"
                accessibilityLabel={t(entry.labelKey)}
                style={styles.row}
                onPress={entry.onPress}
              >
                <CoverMosaic covers={covers} fallback={entry.icon} size={MOSAIC_SIZE} />
                {/* The rule starts at the label and stops at the last row of
                    the group, so the art reads as a column rather than a stack
                    of boxed cells. */}
                <View
                  style={[
                    styles.body,
                    {
                      paddingVertical: density.libraryRowPadding,
                      // Keep the documented floor relative to the padding, or
                      // a one-line row and a two-line row stop matching again.
                      minHeight: MOSAIC_SIZE + density.libraryRowPadding * 2,
                    },
                    index < section.entries.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.labels}>
                    <Text style={[styles.label, { color: colors.secondary }]} numberOfLines={1}>
                      {t(entry.labelKey)}
                    </Text>
                    {/* Zero is a count, not the absence of one. "0 items"
                        under Downloaded says the feature exists and you have
                        none of it; the row going silent said nothing, and read
                        the same as Radio — which genuinely has no count,
                        because fetching one costs a request. */}
                    {count !== undefined && (
                      <Text style={[styles.count, { color: colors.subtext }]} numberOfLines={1}>
                        {t(COUNT_KEY[entry.key], { count })}
                      </Text>
                    )}
                  </View>
                  <ChevronRight size={icons.row} color={colors.subtext} />
                </View>
              </Touchable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** "601 albums" rather than a bare 601: the number on its own left the row
 * saying nothing about what it counted. */
const COUNT_KEY: Record<LibraryEntryKey, string> = {
  playlists: 'library.count.playlists',
  albums: 'library.count.albums',
  artists: 'library.count.artists',
  tracks: 'library.count.tracks',
  genres: 'library.count.genres',
  downloaded: 'library.count.items',
  downloads: 'library.count.items',
  wants: 'library.count.items',
  radio: 'library.count.stations',
  podcasts: 'library.count.podcasts',
  shares: 'library.count.shares',
}

export default LibraryEntryRows

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.label,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGap,
    paddingHorizontal: spacing.page,
  },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    // A minimum rather than padding alone: rows with a count are two lines
    // and rows without are one, so padding by itself made a 15pt height
    // difference between neighbours and left the dividers unevenly spaced.
    // The floor clears the art with room to breathe, so every row matches
    // whether or not it has a subtitle.
  },
  labels: { flexShrink: 1, minWidth: 0, gap: spacing.xxs },
  count: { ...typography.caption },
  label: { ...typography.rowTitle },
})
