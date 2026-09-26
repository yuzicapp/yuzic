import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Skeleton } from 'moti/skeleton';
import { useTheme } from '@/features/theme/useTheme';
import { spacing } from '@/constants/design';
import { useListDensity } from '@/features/theme/useListDensity';

const LoadingSongRow: React.FC = () => {
  const { isDarkMode } = useTheme();
  const colorMode = isDarkMode ? 'dark' : 'light';
  // The same rhythm the real row uses. A flat value here made every track list
  // jump height the moment data arrived at any density but the default.
  const density = useListDensity();

  return (
    <View style={[styles.row, { paddingVertical: density.trackRowPadding }]}>
      <View style={styles.songInfo}>
        {/* Cover art */}
        <Skeleton
          width={44}
          height={44}
          radius={6}
          colorMode={colorMode}
        />

        <View style={styles.textContainer}>
          {/* Song title */}
          <Skeleton
            width="70%"
            height={16}
            radius={6}
            colorMode={colorMode}
          />

          {/* Subtitle (artist • duration) */}
          <View style={{ marginTop: spacing.tight }}>
            <Skeleton
              width="50%"
              height={14}
              radius={6}
              colorMode={colorMode}
            />
          </View>
        </View>
      </View>

      {/* Options button */}
      <Skeleton
        width={20}
        height={20}
        radius={10}
        colorMode={colorMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
});

export default LoadingSongRow;