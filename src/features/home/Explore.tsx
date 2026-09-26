import { spacing, typography } from '@/constants/design';
import { useIconSize } from '@/features/theme/useIconSize';
import SourceBadge from '@/components/SourceBadge';
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet, ScrollView, View, RefreshControl } from 'react-native'
import { Text } from '@/components/Text'
import { CloudOff } from 'lucide-react-native'
import { useScrollToTop } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/features/theme/useTheme'
import { useDailyLayout } from '@/features/home/hooks/useDailyLayout'
import { customizeHomeSections } from '@/features/home/homeLayout'
import { useIsOffline } from '@/features/connectivity/useIsOffline'
import { selectSourceUses } from '@/features/settings/sources/state'
import { selectShowSourceHeaders } from '@/features/settings/appearance/state';
import { resolveHomeShelfOrder, selectHomeServerSectionsEnabled, selectHomeShelfOrders, selectHomeShelfVisibilityMap, type HomeShelfTier } from '@/features/settings/home/state';
import { HOME_SOURCE_TIERS } from '@/providers/registry/homeDiscovery'
import { SOURCES } from '@/providers/registry/sources'

import QuickPicksSection from './components/QuickPicksSection'
import RecentlyPlayed from './components/RecentlyPlayed'
import RecentlyAdded from './components/RecentlyAdded'
import MostPlayedAlbums from './components/MostPlayedAlbums'
import SetAsideAlbums from './components/SetAsideAlbums'
import BecauseYouListenedSection from './components/BecauseYouListenedSection'
import TopArtistsSection from './components/TopArtistsSection'
import ChartsSection from './components/ChartsSection'
import GenreSection from './components/GenreSection'
import ServerRandomSection from './components/ServerRandomSection'
import ServerNowPlayingSection from './components/ServerNowPlayingSection'
import LocalMixSection from './components/LocalMixSection'
import LBSimilarForYouSection from './components/LBSimilarForYouSection'
import LBCreatedForSection from './components/LBCreatedForSection'
import ContinuePlayingSection from './components/ContinuePlayingSection'
import SourceGroup from './components/SourceGroup'
import StatusBanner from '@/components/StatusBanner'
import { ResumeQueueBanner } from './components/ResumeQueueBanner'
import { DownloadsInProgressBanner } from './components/DownloadsInProgressBanner'
import { RefreshSettler } from './components/RefreshSettler'
import { useApi } from '@/providers/registry/useApi'
import type { SectionConfig } from '@/features/home/homeLayout'
import { useScrollClearance } from '@/features/theme/useScrollClearance'
import { useHasScreenBackground } from '@/features/theme/ScreenBackground'

function renderSection(config: SectionConfig, refreshKey: number) {
  switch (config.type) {
    case 'quickPicks':
      return <QuickPicksSection key={config.key} refreshKey={refreshKey} />
    case 'recentlyPlayed':
      return <RecentlyPlayed key={config.key} />
    case 'continuePlaying':
      return <ContinuePlayingSection key={config.key} />
    case 'recentlyAdded':
      return <RecentlyAdded key={config.key} />
    case 'mostPlayed':
      return <MostPlayedAlbums key={config.key} />
    case 'setAside':
      return <SetAsideAlbums key={config.key} />
    case 'charts':
      return <ChartsSection key={config.key} refreshKey={refreshKey} />
    case 'topArtists':
      return <TopArtistsSection key={config.key} refreshKey={refreshKey} />
    case 'becauseYouListened':
      return <BecauseYouListenedSection key={config.key} artistName={config.artistName!} refreshKey={refreshKey} />
    case 'genre':
      return <GenreSection key={config.key} genre={config.genre!} refreshKey={refreshKey} />
    case 'serverRandom':
      return <ServerRandomSection key={config.key} sectionKey={config.key} refreshKey={refreshKey} />
    case 'serverNowPlaying':
      return <ServerNowPlayingSection key={config.key} sectionKey={config.key} />
    case 'localMix':
      return <LocalMixSection key={config.key} sectionKey={config.key} refreshKey={refreshKey} />
    case 'lbSimilarArtistsForYou':
      return <LBSimilarForYouSection key={config.key} sectionKey={config.key} artistNames={config.artistNames ?? [config.artistName!]} refreshKey={refreshKey} />
    case 'lbCreatedFor':
      return <LBCreatedForSection key={config.key} sectionKey={config.key} mixType={config.mixType!} refreshKey={refreshKey} />
    default:
      return null
  }
}

export default function Home() {
  const { t } = useTranslation()
  const icons = useIconSize();
  const scrollClearance = useScrollClearance()

  // Re-tapping the active tab returns to the top of the feed, the way every
  // iOS tab bar behaves. React Navigation drives this off the same `tabPress`
  // the custom tab bar already emits, so the two stay in step.
  const scrollRef = useRef<ScrollView>(null)
  useScrollToTop(scrollRef)

  const { colors } = useTheme()
  const hasBackground = useHasScreenBackground('home')
  const [refreshKey, setRefreshKey] = useState(0)
  const { resume, library, server, sources } = useDailyLayout(refreshKey)
  const isOffline = useIsOffline()
  const sourceUses = useSelector(selectSourceUses)
  const showSourceHeaders = useSelector(selectShowSourceHeaders)
  const homeServerEnabled = useSelector(selectHomeServerSectionsEnabled)
  const homeVisibility = useSelector(selectHomeShelfVisibilityMap)
  const shelfOrders = useSelector(selectHomeShelfOrders)
  // Memoised, down to the rendered elements. Home re-renders whenever
  // something it reads changes, and a section element built fresh on every
  // render re-renders that whole shelf even when nothing about it changed —
  // which on a track change was every shelf on the screen, measured as a
  // single 160–190ms commit. Handing React the same element lets it skip them.
  const visibleResume = useMemo(
    () => customizeHomeSections(resume, homeVisibility, resolveHomeShelfOrder(shelfOrders?.resume, resume.map(s => s.key))),
    [resume, homeVisibility, shelfOrders]
  )
  const visibleLibrary = useMemo(
    () => customizeHomeSections(library, homeVisibility, resolveHomeShelfOrder(shelfOrders?.library, library.map(s => s.key))),
    [library, homeVisibility, shelfOrders]
  )
  const visibleServer = useMemo(
    () => customizeHomeSections(server, homeVisibility, resolveHomeShelfOrder(shelfOrders?.server, server.map(s => s.key))),
    [server, homeVisibility, shelfOrders]
  )
  const visibleSources = useMemo(() => {
    const bySource: Partial<Record<HomeShelfTier, SectionConfig[]>> = {}
    for (const tier of HOME_SOURCE_TIERS) {
      const sections = sources[tier.source] ?? []
      bySource[tier.source] = customizeHomeSections(
        sections, homeVisibility, resolveHomeShelfOrder(shelfOrders?.[tier.source], sections.map(s => s.key))
      )
    }
    return bySource
  }, [sources, homeVisibility, shelfOrders])
  const api = useApi()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // The spinner clears when the refresh's fetches complete — see
  // `RefreshSettler`, which is mounted only while one is in flight.
  const clearRefreshing = useCallback(() => setIsRefreshing(false), [])

  const onRefresh = useCallback(() => {
    setIsRefreshing(true)
    setRefreshKey(k => k + 1)
  }, [])

  const resumeElements = useMemo(
    () => visibleResume.map(config => renderSection(config, refreshKey)),
    [visibleResume, refreshKey]
  )
  const libraryElements = useMemo(
    () => visibleLibrary.map(config => renderSection(config, refreshKey)),
    [visibleLibrary, refreshKey]
  )

  // Server discovery is on whenever the adapter provides it — no per-user
  // toggle, matching how radio and shares appear only where the server can
  // back them. Every outside tier waits for its source's Home switch, and is
  // not attempted offline.
  const sourceGroups = useMemo(() => {
    const groups = [
      {
        id: 'server',
        label: t('explore.sources.server'),
        // Your own server is not a third-party brand, so it gets the app's own
        // accent rather than borrowing an outside source's colour.
        color: colors.themeColor,
        letter: 'S',
        sections: visibleServer,
        enabled: Boolean(api.discovery) && homeServerEnabled,
      },
      ...HOME_SOURCE_TIERS.map(tier => ({
        id: tier.source,
        label: t(SOURCES[tier.source].nameKey),
        color: tier.badge.color,
        letter: tier.badge.letter,
        sections: visibleSources[tier.source] ?? [],
        enabled: Boolean(sourceUses?.[`${tier.source}.homeShelves`]) && !isOffline,
      })),
    ]
    return groups.map(source => {
      if (!source.enabled || source.sections.length === 0) return null
      // The shelves under a source decide for themselves whether they have
      // anything; the group withholds the heading until one of them says it
      // does, so a source that renders nothing takes its label with it.
      return (
        <SourceGroup
          key={source.id}
          sectionKeys={source.sections.map(config => config.key)}
          header={
            <View style={styles.sourceHeader}>
              {showSourceHeaders && (
                <SourceBadge letter={source.letter} color={source.color} />
              )}
              <Text style={[styles.sourceHeaderText, { color: colors.subtext }]}>
                {source.label}
              </Text>
            </View>
          }
        >
          {source.sections.map(config => renderSection(config, refreshKey))}
        </SourceGroup>
      )
    })
  }, [t, colors.themeColor, colors.subtext, visibleServer, visibleSources, api.discovery, homeServerEnabled, sourceUses, isOffline, showSourceHeaders, refreshKey])

  return (
    <ScrollView
      ref={scrollRef}
      // Transparent over the theme's background image, which HomeScreen draws behind it.
      style={[styles.container, { backgroundColor: hasBackground ? 'transparent' : colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: scrollClearance }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.secondary}
        />
      }
    >
      {isRefreshing && <RefreshSettler onSettled={clearRefreshing} />}
      {/* Library and Search both say when the server is out of reach; Home was
          the one tab that changed silently, and it is the tab where the change
          is largest — every discovery shelf goes, because each is a request. */}
      {isOffline && (
        <StatusBanner
          icon={<CloudOff size={icons.badge} color={colors.subtext} />}
          text={t('explore.offlineBanner')}
          style={styles.offlineBanner}
          testID="home-offline-banner"
        />
      )}
      <ResumeQueueBanner />
      <DownloadsInProgressBanner />

      {resumeElements}

      {visibleLibrary.length > 0 && (
        <>
          <View style={styles.sourceHeader}>
            <Text style={[styles.sourceHeaderText, { color: colors.subtext }]}>
              {t('explore.sections.fromYourLibrary')}
            </Text>
          </View>
          {libraryElements}
        </>
      )}

      {sourceGroups}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingTop: spacing.md,
  },
  // The same inset Library's banner takes, so the two tabs put it in the
  // same place rather than each finding its own.
  offlineBanner: {
    marginHorizontal: spacing.page,
    marginBottom: spacing.sm,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.roomy,
    paddingBottom: spacing.xs,
  },
  sourceHeaderText: {
    ...typography.label,
  },
})
