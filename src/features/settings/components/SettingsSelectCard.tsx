import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import SettingsCard from './SettingsCard';
import SettingsDivider from './SettingsDivider';
import SettingsRow from './SettingsRow';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { spacing, typography } from '@/constants/design';

type SelectItem = { key: string; label: string };

type Props = {
  title?: string;
  items: SelectItem[];
  isSelected: (key: string) => boolean;
  onSelect: (key: string) => void;
  multiSelect?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
};

const SettingsSelectCard: React.FC<Props> = ({
  title,
  items,
  isSelected,
  onSelect,
  multiSelect = false,
  isLoading = false,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const icons = useIconSize();

  return (
    <>
      {title && (
        <Text style={[styles.title, { color: colors.subtext }]}>{title}</Text>
      )}
      <SettingsCard>
        {isLoading ? (
          <View style={styles.loader}>
            <SpinningLoaderCircle size={icons.row} color={colors.themeColor} />
          </View>
        ) : (
          items.map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 && <SettingsDivider />}
              <SettingsRow
                label={item.label}
                onPress={() => !disabled && onSelect(item.key)}
                {...(multiSelect
                  ? { checked: isSelected(item.key) }
                  : { selected: isSelected(item.key) }
                )}
              />
            </React.Fragment>
          ))
        )}
      </SettingsCard>
    </>
  );
};

export default SettingsSelectCard;

const styles = StyleSheet.create({
  title: {
    ...typography.caption,
    marginBottom: spacing.tight,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  loader: {
    paddingVertical: spacing.roomy,
    alignItems: 'center',
  },
});
