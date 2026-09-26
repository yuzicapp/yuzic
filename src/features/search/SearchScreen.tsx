import { contentWidth, hitSlopFor, iconSize, spacing, tinted, typography } from '@/constants/design';
import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, ScrollView } from 'react-native';
import { CloudOff, SlidersHorizontal, Search as SearchIcon, X } from 'lucide-react-native';
import { useScrollToTop } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/features/theme/ScreenBackground';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';

import StatusBanner from '@/components/StatusBanner';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import TabHeader from '@/components/TabHeader';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useSearchScreenModel } from '@/features/search/useSearchScreenModel';
import SearchFiltersSheet from './components/SearchFiltersSheet';
import SearchResultsBody from './components/SearchResultsBody';

/**
 * The Search screen's JSX and styling only — every piece of state, effect,
 * and handler lives in `useSearchScreenModel`
 * (`src/features/search/useSearchScreenModel.ts`). See that hook for the
 * Library-XOR-Other-sources scope, the debounce, and the history/navigation
 * wiring; this file only lays it out.
 */
const Search = () => {
  const scrollRef = useRef<ScrollView>(null);
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  useScrollToTop(scrollRef);
  const { t } = useTranslation();
  const scrollClearance = useScrollClearance();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const m = useSearchScreenModel();

  return (
    <SafeAreaView testID="search-screen" edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenBackground screen="search" />
      <TabHeader title={t('search.title')} username={m.username} onAccountPress={m.openAccountSheet} />
      <View style={styles.headerRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.muted, borderRadius: rad.md }]}>
          <SearchIcon size={icons.row} color={colors.placeholder} style={styles.searchIcon} />
          <TextInput
            accessibilityLabel={t('a11y.searchInput')}
            testID="search-input"
            ref={m.searchInputRef}
            style={[styles.searchInput, { color: colors.secondary }]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.placeholder}
            value={m.query}
            onChangeText={m.onSearchChange}
            onFocus={m.onSearchFocus}
            onBlur={m.onSearchBlur}
            returnKeyType="search"
            onSubmitEditing={m.onSearchSubmit}
            // A library is full of names iOS has never seen — `pornophonique`,
            // `netBloc`, `Ugress`. Left to its defaults the field capitalises
            // the first letter and autocorrects the rest into English words,
            // so the query that reaches the server is not the one that was
            // typed. None of the three helps when the target is a proper noun.
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            clearButtonMode="never"
          />
          {m.query !== '' && (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={t('a11y.search.clear')}
              style={styles.clearButton}
              hitSlop={hitSlopFor(20)}
              onPress={m.clearQuery}
            >
              <X size={iconSize.control} color={colors.secondary} />
            </Touchable>
          )}
        </View>
        <Touchable
          testID="search-filters-button"
          accessibilityRole="button"
          accessibilityLabel={t('search.filters.title')}
          accessibilityState={{ selected: m.isOtherScope }}
          style={[
            styles.filtersButton,
            { backgroundColor: m.isOtherScope ? tinted(colors.themeColor, 'selected') : colors.muted, borderRadius: rad.md },
          ]}
          onPress={() => filtersSheetRef.current?.present()}
        >
          <SlidersHorizontal size={icons.row} color={m.isOtherScope ? colors.themeColor : colors.secondary} />
        </Touchable>
      </View>

      {m.hasSearched && !m.isLoading && (m.hasError || m.degraded) && (
        <StatusBanner
          icon={<CloudOff size={icons.badge} color={colors.subtext} />}
          text={m.hasError ? t('search.searchError') : t('search.searchLocalOnly')}
          closable
          style={styles.errorBanner}
          testID="search-error-banner"
        />
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollClearance }]}
        keyboardShouldPersistTaps="handled"
        // Scrolling the results puts the keyboard away, the way every other
        // iOS search screen behaves. Without this the keyboard covers the
        // bottom half of the results (and the mini player) for as long as the
        // query is on screen, and there is no gesture that dismisses it:
        // `keyboardShouldPersistTaps="handled"` deliberately swallows taps on
        // empty space, so the field can only be dismissed by submitting.
        keyboardDismissMode="on-drag"
      >
        <SearchResultsBody m={m} />
      </ScrollView>

      <SearchFiltersSheet
        ref={filtersSheetRef}
        resultScope={m.resultScope}
        onChangeScope={m.setResultScope}
        availableSourceIds={m.enabledSearchSourceIds}
        selectedSourceIds={m.selectedSourceIds}
        onToggleSource={m.toggleFilterSource}
        selectedEntityTypes={m.selectedEntityTypes}
        onToggleEntityType={m.toggleFilterEntityType}
      />
    </SafeAreaView>
  );
};

export default Search;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersButton: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: 0,
    // Results are rows; rows are capped and centred like every other column
    // of them. The field above stays the width of the window.
    width: '100%',
    maxWidth: contentWidth.readable,
    alignSelf: 'center',
  },
});
