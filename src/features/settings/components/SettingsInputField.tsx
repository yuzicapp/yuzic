import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  label: string;
  value: string | undefined;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

const SettingsInputField: React.FC<Props> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
}) => {
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.muted,
            color: colors.text,
            borderRadius: rad.md,
          },
        ]}
      />
    </View>
  );
};

export default SettingsInputField;

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.tight,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    padding: spacing.controlGap,
  },
});
