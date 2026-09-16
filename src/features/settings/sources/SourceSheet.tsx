import React, { forwardRef } from 'react';
import { StyleSheet, Switch, Text } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetRow,
  OptionSheetSectionLabel,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { onDark, spacing, statusColor, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import { SOURCES, usesOf, type SourceId } from '@/providers/registry/sources';
import { selectSourceUses, setSourceUse, stopUsingSource } from './state';

type Props = {
  source: SourceId | null;
  onDone: () => void;
};

/**
 * One source's details: what it is sent, every use with its switch, and a way
 * to stop using it altogether. Every source list opens the same sheet, so
 * there is no separate page to go and find.
 */
const SourceSheet = forwardRef<BottomSheetModal, Props>(({ source, onDone }, ref) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();
  const uses = useSelector(selectSourceUses);

  const declaration = source ? SOURCES[source] : undefined;
  const name = declaration ? t(declaration.nameKey) : '';
  const inUse = source ? usesOf(source).some(entry => uses[entry.id]) : false;

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      onDismiss={onDone}
    >
      <BottomSheetScrollView style={sheetBg} contentContainerStyle={sheetContent}>
        {declaration && source && (
          <>
            <Text style={[styles.title, { color: colors.secondary }]}>{name}</Text>
            <Text style={[styles.body, { color: colors.subtext }]}>{t(declaration.sendsKey)}</Text>

            <OptionSheetSectionLabel label={t('settings.sources.usedFor')} />
            {usesOf(source).map(entry => (
              <OptionSheetRow
                key={entry.id}
                label={t(`settings.sourcePurposes.${entry.purpose}`)}
                description={t(entry.subtextKey)}
                trailing={(
                  <Switch
                    testID={`source-sheet-use-${entry.id}`}
                    value={uses[entry.id] ?? false}
                    onValueChange={enabled => { dispatch(setSourceUse({ use: entry.id, enabled })); }}
                    trackColor={{ true: colors.themeColor }}
                    thumbColor={onDark.text}
                  />
                )}
              />
            ))}
            {inUse && (
              <>
                <OptionSheetDivider />
                <OptionSheetRow
                  testID="source-sheet-stop"
                  label={t('settings.sources.stopUsing', { name })}
                  labelColor={statusColor.destructive}
                  onPress={() => {
                    dispatch(stopUsingSource(source));
                    onDone();
                  }}
                />
              </>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

SourceSheet.displayName = 'SourceSheet';

export default SourceSheet;

const styles = StyleSheet.create({
  title: {
    ...typography.rowTitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.rowSubtitle,
    marginBottom: spacing.sm,
  },
});
