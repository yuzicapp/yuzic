import React, { forwardRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/features/theme/useTheme';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetHeader,
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { iconSize } from '@/constants/design';
import type { CoverSource } from '@/domain/entities/Cover';
import type { ResolvedAction } from './types';

interface EntityOptionsSheetHeader {
  cover: CoverSource;
  title: string;
  subtitle?: string;
  titleLines?: number;
}

interface EntityOptionsSheetProps {
  snapPoints: string[];
  /**
   * `null` renders a loading spinner instead of the header/actions/info —
   * for the "album/artist/playlist not loaded yet" case every collection
   * sheet has. Deliberately still routed through this one component (not a
   * separate early-returned `<BottomSheetModal>` in the caller) so the sheet
   * mounted while data is loading is the *same* `BottomSheetModal` instance
   * once it arrives, not a remount — matching the pre-consolidation sheets,
   * which had a single `if (!x) return <BottomSheetModal>…spinner…` inside
   * one component function rather than two components.
   */
  header: EntityOptionsSheetHeader | null;
  actions?: ResolvedAction[];
  /** Media/album/playlist/artist info rows — pure display, not actions, so not part of the registry. */
  infoSection?: ReactNode;
  onChange?: (index: number) => void;
  stackBehavior?: 'push' | 'replace';
  enablePanDownToClose?: boolean;
  testID?: string;
}

/**
 * The one sheet shell every entity-options sheet renders through. It knows
 * nothing about songs, albums, artists or playlists — it renders whatever
 * `useEntityActions` resolved, plus the caller's own info-section slot for
 * the parts of each sheet that were never actions (duration, genres, dates,
 * play counts).
 */
export const EntityOptionsSheet = forwardRef<BottomSheetModal, EntityOptionsSheetProps>(
  (
    { snapPoints, header, actions = [], infoSection, onChange, stackBehavior = 'push', enablePanDownToClose = true, testID },
    ref
  ) => {
    const { colors } = useTheme();
    const sheetBg = useOptionSheetBackground();
    const sheetContent = useOptionSheetContentStyle();

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
        stackBehavior={stackBehavior}
        onChange={onChange}
      >
        {header === null ? (
          <View style={[optionSheetStyles.loading, sheetBg]}>
            <SpinningLoaderCircle size={iconSize.loader} color={colors.subtext} />
          </View>
        ) : (
          <BottomSheetScrollView
            testID={testID}
            style={sheetBg}
            contentContainerStyle={sheetContent}
          >
            <OptionSheetHeader cover={header.cover} title={header.title} subtitle={header.subtitle} titleLines={header.titleLines} />

            <OptionSheetDivider />

            {actions.map(action => (
              <OptionSheetRow
                key={action.id}
                testID={action.testID}
                icon={action.icon}
                label={action.label}
                onPress={action.onPress}
                disabled={action.disabled}
                dimRow={action.dimRow}
                dimLabel={action.dimLabel}
                loading={action.loading}
                labelColor={action.labelColor}
                trailing={action.trailing}
              />
            ))}

            {infoSection}
          </BottomSheetScrollView>
        )}
      </BottomSheetModal>
    );
  }
);

EntityOptionsSheet.displayName = 'EntityOptionsSheet';
