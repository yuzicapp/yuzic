import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/features/theme/useTheme';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetRow,
  OptionSheetSectionLabel,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { ALL_SOURCES, getSourceMeta, type SourceId } from '@/features/sources/registry';
import { promptSourceUse } from '@/features/settings/sources/sourceUsePrompt';
import { searchUseOf } from '@/providers/registry/sources';
import { iconSize, spacing, typography } from '@/constants/design';
import type { SearchEntityType } from '@/features/search/SearchContext';
import type { SearchResultScope } from '@/features/search/searchLegs';

type Props = {
  resultScope: SearchResultScope;
  onChangeScope: (scope: SearchResultScope) => void;
  /** Sources enabled for search at all. The rest are listed beside them, and
   *  turning one on doesn't mean leaving the search. */
  availableSourceIds: SourceId[];
  selectedSourceIds: string[];
  onToggleSource: (sourceId: SourceId) => void;
  selectedEntityTypes: SearchEntityType[];
  onToggleEntityType: (entityType: SearchEntityType) => void;
};

const SCOPE_ORDER: SearchResultScope[] = ['library', 'other'];
const ENTITY_TYPE_ORDER: SearchEntityType[] = ['album', 'artist'];

/**
 * The Search filter sheet. It owns the whole scope choice now — "Your Library"
 * vs "Other sources" is the first section here rather than a segmented control
 * on the screen, so the search field gets the full width and the one control
 * to its right holds every search decision. Picking "Other sources" reveals the
 * source and entity-type filters beneath; "Your Library" hides them because
 * they don't apply to a local search.
 *
 * Every source is the same kind of row, a check for whether it is in *this*
 * search, in a fixed order so nothing moves. A source that is off says so and
 * what it would be sent; checking it asks first, in the same sheet that asks
 * about previews, because it starts sending searches somewhere new. Saying yes
 * turns its search use on and checks it. A switch or a "Turn on" action here
 * made one list do two jobs, and the row changed shape once it was on.
 */
const SearchFiltersSheet = forwardRef<BottomSheetModal, Props>(
  ({ resultScope, onChangeScope, availableSourceIds, selectedSourceIds, onToggleSource, selectedEntityTypes, onToggleEntityType }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const sheetBg = useOptionSheetBackground();
    const sheetContent = useOptionSheetContentStyle();

    const entityTypeLabel = (entityType: SearchEntityType) => t(`search.entityTypes.${entityType}`);
    const anySourceOff = ALL_SOURCES.some(source => !availableSourceIds.includes(source.id));
    const askToTurnOn = (sourceId: SourceId) =>
      promptSourceUse(searchUseOf(sourceId), {
        // Turned on from here, it's wanted for this search too.
        onTurnOn: () => {
          if (!selectedSourceIds.includes(sourceId)) onToggleSource(sourceId);
        },
      });

    const snapPoints = useMemo(() => ['50%'], []);
    const isOther = resultScope === 'other';

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      >
        <BottomSheetScrollView style={sheetBg} contentContainerStyle={sheetContent}>
          <Text style={[styles.title, { color: colors.secondary }]}>
            {t('search.filters.title')}
          </Text>

          <OptionSheetSectionLabel label={t('search.filters.scope')} />
          {SCOPE_ORDER.map(scope => {
            const checked = resultScope === scope;
            return (
              <OptionSheetRow
                key={scope}
                testID={`search-filters-scope-${scope}`}
                label={t(`search.scope.${scope}`)}
                onPress={() => onChangeScope(scope)}
                trailing={checked ? <Check size={iconSize.secondary} color={colors.themeColor} /> : undefined}
              />
            );
          })}

          {isOther && (
            <>
              <OptionSheetDivider />

              <OptionSheetSectionLabel label={t('search.filters.sources')} />
              {ALL_SOURCES.map(({ id: sourceId }) => {
                const label = getSourceMeta(sourceId)?.label ?? sourceId;
                const isOn = availableSourceIds.includes(sourceId);
                const checked = isOn && selectedSourceIds.includes(sourceId);
                return (
                  <OptionSheetRow
                    key={sourceId}
                    testID={`search-filters-source-${sourceId}`}
                    label={label}
                    description={isOn ? undefined : t('search.filters.sourceOff', { name: label })}
                    onPress={() => (isOn ? onToggleSource(sourceId) : askToTurnOn(sourceId))}
                    trailing={checked ? <Check size={iconSize.secondary} color={colors.themeColor} /> : undefined}
                  />
                );
              })}
              {anySourceOff && (
                <Text style={[styles.note, { color: colors.subtext }]}>
                  {t('search.filters.alsoInSettings')}
                </Text>
              )}

              <OptionSheetDivider />

              <OptionSheetSectionLabel label={t('search.filters.entityTypes')} />
              {ENTITY_TYPE_ORDER.map(entityType => {
                const checked = selectedEntityTypes.includes(entityType);
                return (
                  <OptionSheetRow
                    key={entityType}
                    testID={`search-filters-entity-${entityType}`}
                    label={entityTypeLabel(entityType)}
                    onPress={() => onToggleEntityType(entityType)}
                    trailing={checked ? <Check size={iconSize.secondary} color={colors.themeColor} /> : undefined}
                  />
                );
              })}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

SearchFiltersSheet.displayName = 'SearchFiltersSheet';

export default SearchFiltersSheet;

const styles = StyleSheet.create({
  title: {
    ...typography.rowTitle,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  note: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
