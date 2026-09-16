import { hitSlopFor, iconSize, motion, spacing, typography } from '@/constants/design';
import React, { forwardRef, useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePlayingProgress, usePlayingActions } from '@/features/playback/PlayingContext';
import { useTheme } from '@/features/theme/useTheme';
import { LyricsResult } from '@/providers/contracts/ServerAdapter';
import { ChevronDown } from 'lucide-react-native';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  optionSheetStyles,
  useOptionSheetBackground,
  useSheetBottomInset,
} from '@/components/options/OptionSheetPrimitives';
import Touchable from '@/components/Touchable';
type LyricsBottomSheetProps = {
  lyrics: LyricsResult | null;
  onClose: () => void;
};

function getCurrentLineIndex(
  lines: { startMs: number }[],
  positionSeconds: number
): number {
  const timeMs = positionSeconds * 1000;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (timeMs >= lines[i].startMs) return i;
  }
  return 0;
}

function LyricLine({
  text,
  variant,
  activeColor,
  inactiveColor,
}: {
  text: string;
  variant: 'active' | 'adjacent' | 'inactive';
  activeColor: string;
  inactiveColor: string;
}) {
  const opacityTarget =
    variant === 'active' ? 1 : variant === 'adjacent' ? 0.85 : 0.5;
  const opacity = useSharedValue(opacityTarget);

  useEffect(() => {
    opacity.value = withTiming(opacityTarget, { duration: motion.contentFade });
  }, [opacity, opacityTarget]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const color = variant === 'active' ? activeColor : inactiveColor;
  const fontWeight = variant === 'active' ? '700' : '500';

  return (
    <Animated.Text
      numberOfLines={4}
      style={[styles.line, { color, fontWeight }, animatedStyle]}
    >
      {text}
    </Animated.Text>
  );
}

const LyricsBottomSheet = forwardRef<BottomSheetModal, LyricsBottomSheetProps>(
  ({ lyrics, onClose }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const progress = usePlayingProgress();
    const { seekSong } = usePlayingActions();
    const bottomInset = useSheetBottomInset();
    const sheetBg = useOptionSheetBackground();
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const lineLayouts = useRef<Record<number, { y: number; height: number }>>({});
    const [contentHeight, setContentHeight] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [layoutVersion, setLayoutVersion] = useState(0);

    const lines = useMemo(() => lyrics?.lines ?? [], [lyrics?.lines]);
    // Unsynced lines all carry `startMs: 0`, which would otherwise resolve to
    // "the last line is current" forever — highlighting the wrong line and
    // pinning the scroll to the bottom. There is no current line without
    // timings, so there is no highlight and no follow.
    const synced = lyrics?.synced ?? false;
    const currentIndex = useMemo(
      () => (synced ? getCurrentLineIndex(lines, progress.position) : -1),
      [synced, lines, progress.position]
    );

    useEffect(() => {
      lineLayouts.current = {};
    }, [lyrics?.lines]);

    const onLineLayout = (index: number) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      lineLayouts.current[index] = { y, height };
      if (index === currentIndex) {
        setLayoutVersion((v) => v + 1);
      }
    };

    useEffect(() => {
      if (!lines.length || !scrollRef.current || viewportHeight === 0) return;

      const layout = lineLayouts.current[currentIndex];
      if (!layout || contentHeight === 0) return;

      const padding = 80;
      const visibleHeight = viewportHeight - padding * 2;
      const lineCenterY = layout.y + layout.height / 2;
      const targetScrollY = lineCenterY - visibleHeight / 2;
      const maxScroll = Math.max(0, contentHeight - visibleHeight);
      const clampedY = Math.max(0, Math.min(targetScrollY, maxScroll));

      scrollRef.current.scrollTo({
        y: clampedY,
        animated: true,
      });
    }, [currentIndex, lines.length, contentHeight, viewportHeight, layoutVersion]);

    if (!lyrics) return null;

    const getVariant = (index: number): 'active' | 'adjacent' | 'inactive' => {
      // Nothing is "current" in a plain block, so every line reads the same
      // rather than the whole sheet sitting greyed out.
      if (!synced) return 'active';
      if (index === currentIndex) return 'active';
      if (index === currentIndex - 1 || index === currentIndex + 1)
        return 'adjacent';
      return 'inactive';
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['90%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        stackBehavior="push"
        onDismiss={onClose}
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <View style={[styles.header, { paddingTop: spacing.md }]}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.common.close')}
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={hitSlopFor(40)}
          >
            <ChevronDown size={iconSize.large} color={colors.secondary} />
          </Touchable>
          <Text
            style={[styles.title, { color: colors.secondary }]}
            numberOfLines={1}
          >
            {t('playing.lyrics.title')}
          </Text>
          <View style={styles.closeButton} />
        </View>

        <BottomSheetScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
              paddingBottom: bottomInset + spacing.generous,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(w, h) => setContentHeight(h)}
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        >
          {lines.map((line, index) =>
            // Tapping a line seeks to it, which an untimed line cannot do —
            // so it isn't a button, and isn't announced as one.
            synced ? (
              <Touchable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={line.text}
                accessibilityHint={t('a11y.player.seekToLyric')}
                onLayout={onLineLayout(index)}
                onPress={() => seekSong(line.startMs / 1000)}
              >
                <LyricLine
                  text={line.text}
                  variant={getVariant(index)}
                  activeColor={colors.secondary}
                  inactiveColor={colors.subtext}
                />
              </Touchable>
            ) : (
              <LyricLine
                key={index}
                text={line.text}
                variant={getVariant(index)}
                activeColor={colors.secondary}
                inactiveColor={colors.subtext}
              />
            )
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

LyricsBottomSheet.displayName = 'LyricsBottomSheet';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.navigationTitle,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  line: {
    ...typography.screenTitle,
    textAlign: 'center',
    marginVertical: spacing.controlGap,
  },
});

export default LyricsBottomSheet;
