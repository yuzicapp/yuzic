import { motion, onDark, onDarkAlpha, spacing, typography, veil } from '@/constants/design';
import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { LyricsResult } from '@/providers/contracts/ServerAdapter';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  lyrics: LyricsResult;
  position: number;
  contentWidth: number;
  onPress: () => void;
};

const CARD_HEIGHT = 220;
const CARD_PADDING_V = 28;

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
}: {
  text: string;
  variant: 'active' | 'adjacent' | 'inactive';
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

  const baseStyle =
    variant === 'active' ? styles.activeLine : styles.inactiveLine;

  return (
    <Animated.Text
      numberOfLines={2}
      style={[styles.line, baseStyle, animatedStyle]}
    >
      {text}
    </Animated.Text>
  );
}

export default function LyricsPreviewCard({
  lyrics,
  position,
  contentWidth,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const rad = useRadius();
  const scrollRef = useRef<ScrollView>(null);
  const lineLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const [contentHeight, setContentHeight] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const lines = useMemo(() => lyrics.lines, [lyrics.lines]);
  /**
   * Unsynced lines all carry `startMs: 0`, so `getCurrentLineIndex` would
   * answer with the *last* line from the first moment of the track — every
   * line "already started" — and the card would open scrolled to the end of
   * the song's words. There is no current line without timings, so there is
   * no highlight and no autoscroll either: the words simply start at the top.
   */
  const synced = lyrics.synced;
  const currentIndex = useMemo(
    () => (synced ? getCurrentLineIndex(lines, position) : -1),
    [synced, lines, position]
  );

  useEffect(() => {
    lineLayouts.current = {};
  }, [lyrics.lines]);

  const onLineLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    lineLayouts.current[index] = { y, height };
    if (index === currentIndex) {
      setLayoutVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    if (!lines.length || !scrollRef.current) return;

    const layout = lineLayouts.current[currentIndex];
    if (!layout || contentHeight === 0) return;

    const visibleHeight = CARD_HEIGHT - CARD_PADDING_V * 2;
    const lineCenterY = layout.y + layout.height / 2;
    const targetScrollY = lineCenterY - visibleHeight / 2;
    const maxScroll = Math.max(0, contentHeight - visibleHeight);
    const clampedY = Math.max(0, Math.min(targetScrollY, maxScroll));

    scrollRef.current.scrollTo({
      y: clampedY,
      animated: true,
    });
  }, [currentIndex, lines.length, contentHeight, layoutVersion]);

  if (!lines.length) return null;

  const getVariant = (index: number): 'active' | 'adjacent' | 'inactive' => {
    // Nothing is "now" without timings, so nothing is dimmed — the same
    // choice `LyricsBottomSheet` makes for the same reason.
    if (!synced) return 'active';
    if (index === currentIndex) return 'active';
    if (index === currentIndex - 1 || index === currentIndex + 1)
      return 'adjacent';
    return 'inactive';
  };

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={t('a11y.player.lyrics')}
      style={[styles.card, { width: contentWidth, height: CARD_HEIGHT, borderRadius: rad.panel }]}
      onPress={onPress}
    >
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(w, h) => setContentHeight(h)}
      >
        {lines.map((line, index) => (
          <View key={index} onLayout={onLineLayout(index)}>
            <LyricLine
              text={line.text}
              variant={getVariant(index)}
            />
          </View>
        ))}
      </ScrollView>

    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    paddingVertical: CARD_PADDING_V,
    paddingHorizontal: spacing.xl,
    backgroundColor: veil.card,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: spacing.xs,
  },
  line: {
    ...typography.sectionTitle,
    textAlign: 'center',
    marginVertical: spacing.tight,
  },
  activeLine: {
    color: onDark.text,
    fontWeight: '600',
  },
  inactiveLine: {
    color: onDarkAlpha.body,
    fontWeight: '500',
  },
});
