import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/Text';
import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Touchable from '@/components/Touchable';
import { useSheetRef } from '@/components/useSheetRef';
import { hitSlopFor, iconSize, onDark, spacing, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import { SOURCES, usesFor, type SourceId, type SourcePurpose } from '@/providers/registry/sources';
import SettingsCard from '../components/SettingsCard';
import SettingsDivider from '../components/SettingsDivider';
import ServerAddressSheet from './ServerAddressSheet';
import SourceSheet from './SourceSheet';
import { selectSourceUses, setSourceUse } from './state';

type Props = {
  purpose: SourcePurpose;
  /** Only this source's use — a Home tier is one source's shelves. */
  source?: SourceId;
};

/**
 * Every source that can provide one kind of data, in the order they are
 * tried, each with its switch.
 *
 * A switch here takes effect at once. Flipping a labelled switch in Settings
 * is already the decision, so asking again only added a step; what a source
 * is sent is one tap away, on its ⓘ button.
 */
export default function SourceUseList({ purpose, source }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const uses = useSelector(selectSourceUses);
  const sheetRef = useSheetRef();
  const [detailsFor, setDetailsFor] = useState<SourceId | null>(null);

  const entries = usesFor(purpose).filter(entry => !source || entry.source === source);

  // The address form is opened by the details sheet but belongs beside it, not
  // inside it: it waits for that sheet to finish closing, so the two are never
  // on screen together.
  const [addressFor, setAddressFor] = useState<SourceId | null>(null);
  const addressAfterClose = useRef<SourceId | null>(null);

  const openDetails = useCallback((next: SourceId) => {
    setDetailsFor(next);
    requestAnimationFrame(() => sheetRef.current?.present());
  }, [sheetRef]);

  return (
    <>
      <SettingsCard>
        {entries.map((entry, index) => {
          const name = t(SOURCES[entry.source].nameKey);
          return (
            <React.Fragment key={entry.id}>
              {index > 0 && <SettingsDivider />}
              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={[styles.label, { color: colors.secondary }]}>{name}</Text>
                  <Text style={[styles.subtext, { color: colors.subtext }]}>{t(entry.subtextKey)}</Text>
                </View>
                <Touchable
                  testID={`source-use-details-${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.settings.sourceDetails', { name })}
                  onPress={() => openDetails(entry.source)}
                  hitSlop={hitSlopFor(iconSize.row)}
                >
                  <Info size={iconSize.row} color={colors.subtext} />
                </Touchable>
                <Switch
                  testID={`source-use-${entry.id}`}
                  accessibilityLabel={name}
                  value={uses[entry.id] ?? false}
                  onValueChange={enabled => { dispatch(setSourceUse({ use: entry.id, enabled })); }}
                  trackColor={{ true: colors.themeColor }}
                  thumbColor={onDark.text}
                />
              </View>
            </React.Fragment>
          );
        })}
      </SettingsCard>
      <SourceSheet
        ref={sheetRef}
        source={detailsFor}
        onEditAddress={next => {
          addressAfterClose.current = next;
          sheetRef.current?.dismiss();
        }}
        onDone={() => {
          sheetRef.current?.dismiss();
          setDetailsFor(null);
          const next = addressAfterClose.current;
          addressAfterClose.current = null;
          if (next) setAddressFor(next);
        }}
      />
      {addressFor && <ServerAddressSheet source={addressFor} onClose={() => setAddressFor(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.rowTitle,
  },
  subtext: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
});
