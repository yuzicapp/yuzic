import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Skeleton } from 'moti/skeleton';
import { useTheme } from '@/features/theme/useTheme';
import { radius, controlSize, spacing } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

const LoadingArtistHeader: React.FC = () => {
  const { isDarkMode } = useTheme();
  const rad = useRadius();
  const colorMode = isDarkMode ? 'dark' : 'light';

  return (
    <>
      {/* FULL BLEED BACKGROUND */}
      <View style={styles.fullBleedWrapper}>
        <Skeleton
          width="100%"
          height={300}
          colorMode={colorMode}
        />

        {/* CENTERED ARTIST IMAGE */}
        <View style={[styles.centeredCoverContainer, { borderRadius: rad.pill }]}>
          <Skeleton
            width={120}
            height={120}
            radius={rad.thumb}
            colorMode={colorMode}
          />
        </View>
      </View>

      {/* ARTIST META */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={styles.content}>
          <Skeleton
            width={180}
            height={28}
            radius={rad.thumb}
            colorMode={colorMode}
          />

          <View style={styles.metaRow}>
            <Skeleton
              width={70}
              height={14}
              radius={rad.thumb}
              colorMode={colorMode}
            />
            <Skeleton
              width={8}
              height={8}
              radius={radius.xs}
              colorMode={colorMode}
            />
            <Skeleton
              width={70}
              height={14}
              radius={rad.thumb}
              colorMode={colorMode}
            />
          </View>
        </View>
      </View>

      {/* SHUFFLE / PLAY / DOWNLOAD */}
      <View style={styles.buttonRow}>
        <Skeleton
          width={controlSize.detailSecondary}
          height={controlSize.detailSecondary}
          radius={rad.pillFor(controlSize.detailSecondary)}
          colorMode={colorMode}
        />
        <Skeleton
          width={controlSize.detailPrimaryWidth}
          height={controlSize.detailPrimaryHeight}
          radius={rad.pillFor(controlSize.detailPrimaryHeight)}
          colorMode={colorMode}
        />
        <Skeleton
          width={controlSize.detailSecondary}
          height={controlSize.detailSecondary}
          radius={rad.pillFor(controlSize.detailSecondary)}
          colorMode={colorMode}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fullBleedWrapper: {
    width: '100%',
    height: 300,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },

  centeredCoverContainer: {
    position: 'absolute',
    bottom: -32,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.controlGap,
    marginBottom: spacing.xl,
  },
});

export default LoadingArtistHeader;