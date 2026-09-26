import React from 'react';
import { statusColor } from '@/constants/design';
import { View, StyleSheet } from 'react-native';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  isLoading: boolean;
  isConnected: boolean;
};

const ConnectivityIndicator: React.FC<Props> = ({ isLoading, isConnected }) => {
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();

  if (isLoading) {
    return <SpinningLoaderCircle size={icons.badge} color={colors.themeColor} />;
  }

  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: isConnected ? statusColor.success : colors.border, borderRadius: rad.pill },
      ]}
    />
  );
};

export default ConnectivityIndicator;

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
  },
});
