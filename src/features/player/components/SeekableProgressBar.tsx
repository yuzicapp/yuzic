import { motion, onDark } from '@/constants/design';
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useRadius } from '@/features/theme/useRadius';

type SeekableProgressBarProps = {
  value: number;
  duration: number;
  onSeek: (position: number) => void;
  fillColor?: string;
  trackColor?: string;
  style?: object;
};

const ratioAt = (x: number, width: number): number => {
  'worklet';
  return width > 0 ? Math.max(0, Math.min(1, x / width)) : 0;
};

/**
 * The player's seek bar: tap to jump, or drag to scrub.
 *
 * A gesture-handler pan rather than a PanResponder, because the player it
 * sits in is one. The drag-to-close pan and the scroll view around it are
 * native gestures, and a native gesture that activates cancels the JS
 * responder outright — so a scrub became `onPanResponderTerminate` a few
 * points in, and the seek it was carrying was dropped (#305). A tap ended
 * before anything could claim it, which is why tapping always worked. Same
 * shape as the cover swipe beside it: horizontal only, refusing vertical
 * movement so the scroll and drag-to-close keep theirs.
 */
export const SeekableProgressBar: React.FC<SeekableProgressBarProps> = ({
  value,
  duration,
  onSeek,
  fillColor = onDark.text,
  trackColor = onDark.mutedText,
  style,
}) => {
  const rad = useRadius();
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const width = useSharedValue(0);
  const isSeeking = useSharedValue(false);
  const pendingRatio = useSharedValue(-1);
  const displayRatio = useSharedValue(0);

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);

  useEffect(() => {
    if (isSeeking.value) return;
    const ratio = duration > 0 ? Math.max(0, Math.min(1, value / duration)) : 0;
    // Hold where the finger let go until playback catches up, so the fill
    // does not snap back to the old position for the tick before it.
    if (pendingRatio.value >= 0) {
      if (Math.abs(ratio - pendingRatio.value) > 0.02) return;
      pendingRatio.value = -1;
    }
    displayRatio.value = withTiming(ratio, { duration: motion.progress, easing: Easing.linear });
  }, [value, duration, displayRatio, isSeeking, pendingRatio]);

  const seekTo = useCallback((ratio: number) => {
    onSeekRef.current(ratio * durationRef.current);
  }, []);

  const gesture = useMemo(() => {
    const commit = (x: number) => {
      'worklet';
      const ratio = ratioAt(x, width.value);
      displayRatio.value = ratio;
      pendingRatio.value = ratio;
      isSeeking.value = false;
      runOnJS(seekTo)(ratio);
    };

    const scrub = Gesture.Pan()
      .activeOffsetX([-4, 4])
      .failOffsetY([-14, 14])
      .onStart(event => {
        isSeeking.value = true;
        displayRatio.value = ratioAt(event.x, width.value);
      })
      .onUpdate(event => {
        displayRatio.value = ratioAt(event.x, width.value);
      })
      // Called for a scrub that is cancelled as well as one that ends: if
      // something does take the touch, the listener still lands where the
      // bar was showing rather than nowhere.
      .onEnd(event => {
        commit(event.x);
      });

    const tap = Gesture.Tap().onEnd((event, success) => {
      if (success) commit(event.x);
    });

    return Gesture.Race(scrub, tap);
  }, [displayRatio, isSeeking, pendingRatio, seekTo, width]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
  }, [width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${displayRatio.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View testID="seek-bar" style={[styles.touchTarget, style]} onLayout={handleLayout}>
        <View style={[styles.track, { backgroundColor: trackColor, borderRadius: rad.pill }]}>
          <Animated.View style={[styles.fill, fillStyle, { backgroundColor: fillColor }]} />
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  touchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    marginVertical: -20,
  },
  track: {
    height: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
