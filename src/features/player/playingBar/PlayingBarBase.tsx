import { cappedTypography, fontScaleCap, hitSlopFor, iconSize, radius, spacing } from '@/constants/design';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { InteractionManager, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Music, Play, Pause } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import PlaylistList from '@/components/PlaylistList';
import OutputDeviceSheet from '@/features/player/components/OutputDeviceSheet';
import { MediaImage } from '@/components/MediaImage';
import { usePlayingState, usePlayingActions } from '@/features/playback/PlayingContext';
import { hasDuration } from '@/domain/playback/ContentKind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  PLAYER_SPRING,
  coverHandedOver,
  usePlayerExpansion,
} from '@/features/player/PlayerExpansion';
import { settleFromBar } from '@/features/player/settle';
import { useTheme } from '@/features/theme/useTheme';
import { selectPlayingBarAction } from '@/features/settings/appearance/state';

import { usePlayingBarAction } from './actions/usePlayingBarAction';
import ProgressBarStrip from './ProgressBarStrip';
import { useSheetRef } from '@/components/useSheetRef';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';

const PLACEHOLDER_ICON_SIZE = 32;

/**
 * The faintest the bar is drawn while the player is rising over it.
 *
 * Not zero, deliberately. By the quarter of the travel where this is reached
 * the player's own surface is on its way over the dock, so the bar has
 * something in front of it and does not need to be invisible to be unseen — and
 * a value that can never reach zero is a bar that can never *disappear*, which
 * is the failure mode of #211. The thresholds themselves live in
 * `features/player/settle.ts` with the rest of the drag's arithmetic.
 */
const BAR_MIN_OPACITY = 0.02;

/**
 * The now-playing row at the top of the tab dock. iOS and Android draw it the
 * same way; each platform's `PlayingBar` renders this.
 */
export default function PlayingBarBase() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const themeColor = colors.themeColor;
  const actionMode = useSelector(selectPlayingBarAction);
  const { height } = useWindowDimensions();

  const { currentSong, isPlaying, isBuffering } = usePlayingState();
  const { pauseSong, resumeSong } = usePlayingActions();
  const { expansion, barCover, fullCover, expand, prepare } = usePlayerExpansion();

  // Whether the drag below actually moved the player. A gesture that decided
  // nothing must not settle as though it decided something — see `settle.ts`.
  const dragMoved = useSharedValue(false);

  const playlistSheetRef = useSheetRef();
  const castSheetRef = useSheetRef();

  const primaryAction = usePlayingBarAction(actionMode, {
    presentAddToPlaylist: () => {
      if (currentSong) playlistSheetRef.current?.present();
    },
    presentCast: () => castSheetRef.current?.present(),
  });

  // Where the thumbnail sits on screen, so the player knows where to fly the
  // cover from. Measured rather than computed: the dock changes height with
  // the safe area and with the translucent setting, and a hardcoded rect would
  // be wrong on exactly the devices hardest to check.
  const coverRef = useRef<View>(null);
  const measureCover = useCallback(() => {
    coverRef.current?.measureInWindow((x, y, width) => {
      if (width > 0) barCover.value = { x, y, size: width };
    });
  }, [barCover]);

  // Build the player screen once there is something to open, rather than at
  // the touch that opens it.
  //
  // `prepare` also runs from the press and the drag, but both of those are
  // touch-down: the screen mounts as the gesture starts, so its cover slot is
  // still unmeasured for the first frames and `coverHandedOver` stays false
  // until the measurement lands mid-drag. That is why the first open of a
  // session animated differently from every one after it — by the second, the
  // slot had been measured and the handover could start from the first frame.
  //
  // After interactions, so it never competes with the track that has just
  // started playing; a track change is the one place this tree must stay cheap.
  const hasSong = currentSong != null;
  useEffect(() => {
    if (!hasSong) return;
    const task = InteractionManager.runAfterInteractions(() => prepare());
    return () => task.cancel();
  }, [hasSong, prepare]);

  const handlePlayPause = async () => {
    if (!currentSong) return;
    if (isPlaying) {
      await pauseSong();
    } else {
      await resumeSong();
    }
  };

  const handleExpand = () => {
    if (!currentSong) return;
    measureCover();
    expand();
  };

  // Dragging the bar upward moves the player itself rather than starting an
  // animation and watching it play: `expansion` follows the finger, and only
  // the release is animated. `onBegin` builds the player screen at touch-down
  // so the tree is ready before the drag has travelled far enough to show it.
  const dragToOpen = useMemo(
    () =>
      Gesture.Pan()
        .enabled(currentSong != null)
        // A tap belongs to the pressable. This pan activates only after a
        // deliberate upward pull, and fails as soon as it becomes a downward
        // movement, so ordinary finger settling cannot cancel `onPress` and
        // make the player briefly rise then fall back into the dock.
        .activeOffsetY(-18)
        .failOffsetY(18)
        .failOffsetX([-24, 24])
        .onBegin(() => {
          dragMoved.value = false;
          runOnJS(prepare)();
          runOnJS(measureCover)();
        })
        .onUpdate(event => {
          dragMoved.value = true;
          expansion.value = Math.min(1, Math.max(0, -event.translationY / height));
        })
        // `onFinalize` rather than `onEnd`, so a cancelled or interrupted drag
        // settles too. An exit that names no end is what leaves the bar faded
        // out with the music still playing (#211).
        .onFinalize(event => {
          const target = settleFromBar(expansion.value, event.velocityY, dragMoved.value);
          // A tap: the pressable already started the spring it meant.
          if (target === null) return;
          expansion.value = withSpring(target, PLAYER_SPRING);
        }),
    [currentSong, dragMoved, expansion, height, measureCover, prepare],
  );

  // The bar's own contents step aside early in the travel, leaving the cover
  // to make the journey on its own.
  //
  // Floored at the point the full player has actually covered the bar, so this
  // can only ever hide the bar *behind something*. Fading to a true zero is
  // what turned a stuck intermediate expansion into a bar that had vanished
  // outright (#211): invisible, mounted, and still holding its slot in the
  // dock. The gestures above now always settle, so nothing should park here —
  // and if something ever does, it looks wrong rather than gone.
  const barFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.25], [1, BAR_MIN_OPACITY], Extrapolation.CLAMP),
  }));

  // The thumbnail is handed over to the player host as soon as the host can
  // actually draw it, so there is one piece of cover art in the air rather
  // than two — or, as there used to be on the first drag of a session, none.
  const coverHandoffStyle = useAnimatedStyle(() => ({
    opacity: coverHandedOver(expansion.value, barCover.value, fullCover.value) ? 0 : 1,
  }));

  return (
    <>
      <GestureDetector gesture={dragToOpen}>
        <Animated.View style={barFadeStyle}>
          <Touchable
            accessibilityLabel={currentSong ? t('a11y.player.nowPlayingBar') : t('a11y.player.noSongPlaying')}
            accessibilityRole="button"
            testID={currentSong ? 'playing-bar' : 'playing-bar-empty'}
            onPressIn={prepare}
            onPress={handleExpand}
          >
            <View style={styles.container}>
              <View style={styles.topRowWrapper}>
                <View style={styles.topRow}>
                  <Animated.View
                    ref={coverRef}
                    onLayout={measureCover}
                    style={[styles.coverArt, coverHandoffStyle]}
                  >
                    {currentSong?.cover ? (
                      <MediaImage
                        cover={currentSong.cover}
                        size="thumb"
                        style={styles.coverFill}
                      />
                    ) : (
                      <View style={[styles.coverFill, styles.iconPlaceholder]}>
                        <Music size={PLACEHOLDER_ICON_SIZE} color={colors.secondary} />
                      </View>
                    )}
                  </Animated.View>

                  <View style={styles.details}>
                    <Text
                      testID="playing-bar-title"
                      numberOfLines={1}
                      maxFontSizeMultiplier={fontScaleCap.control}
                      style={[styles.title, { color: colors.secondary }]}
                    >
                      {currentSong?.title || t('playing.bar.noSong')}
                    </Text>
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={fontScaleCap.control}
                      style={[styles.artist, { color: colors.subtext }]}
                    >
                      {currentSong?.artist.name || t('playing.bar.selectTrack')}
                    </Text>
                  </View>

                  {currentSong && (
                    <Touchable
                      accessibilityLabel={isPlaying ? t('a11y.player.pause') : t('a11y.player.play')}
                      accessibilityRole="button"
                      testID="playing-bar-play-pause"
                      style={styles.playPauseButton}
                      onPress={handlePlayPause}
                      hitSlop={hitSlopFor(iconSize.control)}
                    >
                      {isBuffering
                        ? <SpinningLoaderCircle size={iconSize.control} color={colors.secondary} />
                        : isPlaying
                          ? <Pause size={iconSize.header} color={colors.secondary} fill={colors.secondary} />
                          : <Play size={iconSize.header} color={colors.secondary} fill={colors.secondary} />
                      }
                    </Touchable>
                  )}

                  {/* A filled accent disc here made the contextual action the loudest
                      thing in the dock while play/pause was a bare glyph beside it. Both
                      are plain now, separated by size and colour instead. */}
                  {primaryAction && (
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={primaryAction.label}
                      accessibilityState={primaryAction.selected === undefined
                        ? undefined
                        : { selected: primaryAction.selected }}
                      style={styles.actionButton}
                      onPress={primaryAction.onPress}
                      hitSlop={hitSlopFor(iconSize.control)}
                    >
                      {primaryAction.icon}
                    </Touchable>
                  )}
                </View>
              </View>

              {/* A radio station has no meaningful position to draw — hide the strip
               * entirely rather than let it sit flat at zero. Podcast episodes keep it. */}
              {(!currentSong || hasDuration(currentSong.contentKind)) && (
                <ProgressBarStrip
                  fallbackDuration={currentSong?.durationSeconds || 1}
                  fillColor={themeColor}
                  trackColor={colors.border}
                />
              )}
            </View>
          </Touchable>
        </Animated.View>
      </GestureDetector>

      <PlaylistList
        ref={playlistSheetRef}
        selectedSong={currentSong}
        onClose={() => playlistSheetRef.current?.dismiss()}
      />

      <OutputDeviceSheet ref={castSheetRef} />
    </>
  );
}

const styles = StyleSheet.create({
  // No margins, radius or shadow: the bar is the top row of the tab dock,
  // not a card resting on it. The dock owns the surface and the hairline.
  container: {
    flexDirection: 'column',
    // Equal above the row and below it. Tighter than the gap around the
    // 40pt cover was: the art grows into this padding rather than pushing
    // the row taller, so the cover gains prominence and the bar does not
    // gain height.
    paddingTop: spacing.sm,
    paddingBottom: 0,
    paddingHorizontal: spacing.page,
  },
  topRowWrapper: {
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // The artwork sets the row height rather than sitting inside it with
    // slack, so the cover can grow without the dock growing with it.
    minHeight: 48,
  },
  coverArt: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
    borderRadius: radius.sm,
    // The artwork fills this slot now rather than being it, so the slot has to
    // do the clipping — it is what the player measures and hands over.
    overflow: 'hidden',
  },
  coverFill: {
    width: '100%',
    height: '100%',
  },
  details: {
    flex: 1,
  },
  // The title was `caption` like the artist under it, so the two read as
  // one block of small text with no hierarchy. It is the loudest thing in
  // the row now, with the artist staying quiet beneath.
  title: {
    ...cappedTypography.control.compactRowTitle,
    fontWeight: '500',
  },
  artist: {
    ...cappedTypography.control.caption,
    marginTop: spacing.xxs,
  },
  iconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.roomy,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
