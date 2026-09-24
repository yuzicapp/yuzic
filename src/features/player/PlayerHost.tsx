import { onDark, radius, shade, spacing } from '@/constants/design';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  Extrapolation,
} from 'react-native-reanimated';
import ImageColors from 'react-native-image-colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT_CACHE_MAX, createAccentCache, pickAccent, toWashAccent } from '@/features/theme/coverAccent';
import {
  usePlayingActions,
  usePlayingQueueVersion,
  usePlayingState,
} from '@/features/playback/PlayingContext';
import { MediaImage } from '@/components/MediaImage';
import { buildCover } from '@/providers/registry/covers';
import { prefetchCovers } from '@/features/artwork/imageCache';
import { useActiveTheme } from '@/features/theme/useActiveTheme';
import { useLiveCoverAccent } from '@/features/theme/useLiveCoverAccent';
import PlayingScreen from '@/features/player/PlayingScreen';
import PlayingBackground from '@/features/player/components/PlayingBackground';
import { useRadius } from '@/features/theme/useRadius';

import { coverNeighbours } from '@/features/player/coverNeighbours';
import { coverScale, coverSlideSettled } from '@/features/player/coverTransition';

import {
  coverHandedOver,
  EMPTY_COVER_STRIP,
  usePlayerExpansion,
  type CoverStrip,
} from './PlayerExpansion';

const gradientCache = createAccentCache<[string, string]>(ACCENT_CACHE_MAX);

/** What the player fades to with no accent to show — extraction failed, or the
 *  user turned cover tinting off. */
const NEUTRAL_GRADIENT: [string, string] = [onDark.wash, onDark.background];

/**
 * The full-screen player, and the cover art that travels between it and the
 * playing bar.
 *
 * This sits above the navigator and below the bottom-sheet portal, so it
 * covers every screen and the dock, while the option sheets the player opens
 * still come up over it.
 *
 * The player used to be a `BottomSheetModal`, which meant the bar and the
 * screen were two unrelated surfaces: tapping the bar dropped one and raised
 * the other. They are one surface now, at a position the finger can hold.
 */
/** How far the player scrolls before the status bar scrim is fully in. */
const STATUS_SCRIM_FADE = 24;

export default function PlayerHost() {
  const {
    expansion, barCover, fullCover, scrollY, coverVisibility, coverSwipeX, hostOrigin,
    coverSlide, finishCoverSlide, isOpen, hasOpened, collapse,
  } = usePlayerExpansion();
  const { height, width } = useWindowDimensions();
  // The travelling cover is laid out once at a fixed size and only ever
  // scaled, so its width and height stay static styles rather than becoming
  // per-frame layout work.
  const REFERENCE_SIZE = width;
  const { currentSong, currentIndex, repeatMode } = usePlayingState();
  const { getQueue } = usePlayingActions();
  const queueVersion = usePlayingQueueVersion();
  const insets = useSafeAreaInsets();
  const coverAccentEnabled = useActiveTheme().surface.coverTint;
  // The app's accent follows the cover when the theme asks; this is where the
  // cover is known, so this is where it is taken from.
  useLiveCoverAccent();
  const rad = useRadius();

  const [currentGradient, setCurrentGradient] = useState<[string, string]>([onDark.background, onDark.background]);
  const [nextGradient, setNextGradient] = useState<[string, string]>([onDark.background, onDark.background]);

  // The artwork on either side of the playing track, drawn beside it so a drag
  // reveals the real neighbour. A single image could only ever recoil: there
  // was nothing in the space it left behind.
  const liveStrip = useMemo<CoverStrip>(
    () => (currentSong
      ? { current: currentSong.cover, ...coverNeighbours(getQueue(), currentIndex, repeatMode) }
      : EMPTY_COVER_STRIP),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `queueVersion` is what says the queue changed
    [currentSong, currentIndex, repeatMode, getQueue, queueVersion],
  );
  // Held still while a skip is in flight: playback moves the queue the instant
  // it takes the command, and re-deriving the row then would swap the picture
  // the finger is dragging.
  const strip = coverSlide?.strip ?? liveStrip;

  // The whole row at the size the player draws it, before anything asks for
  // one. The neighbours are for the swipe; the *current* one is for the open,
  // and leaving it out is why the first open of a session animated differently
  // from every one after it. The bar draws `thumb` and the player draws
  // `detail`, so opening it cold fetched an image the bar had never needed —
  // and the handover hides the bar's thumbnail as soon as both slots are
  // measured, so what rose was `MediaImage`'s plain surface with the artwork
  // fading in behind it. Every later open found it cached and looked right.
  useEffect(() => {
    prefetchCovers([liveStrip.current, liveStrip.previous, liveStrip.next], 'detail');
  }, [liveStrip]);

  // The skip has committed, so the row is one place out of date: the cover the
  // user pulled in becomes the middle one and the offset returns to zero in
  // the same commit. Together, or the old row is drawn at the new offset for a
  // frame and the artwork appears to snap back.
  useEffect(() => {
    if (!coverSlide || !coverSlideSettled(coverSlide.outgoingSongId, currentSong?.localId)) return;
    coverSwipeX.value = 0;
    finishCoverSlide();
  }, [coverSlide, coverSwipeX, currentSong?.localId, finishCoverSlide]);

  const extractColors = useCallback(async (uri: string) => {
    const cached = gradientCache.get(uri);
    if (cached) {
      setNextGradient(cached);
      return;
    }
    try {
      const result = await ImageColors.getColors(uri, { fallback: onDark.wash });
      const gradient: [string, string] = [toWashAccent(pickAccent(result, onDark.wash)), onDark.background];
      gradientCache.set(uri, gradient);
      setNextGradient(gradient);
    } catch {
      setNextGradient(NEUTRAL_GRADIENT);
    }
  }, []);

  useEffect(() => {
    // With cover tinting off the bar and player keep the neutral dark they
    // already fall back to when extraction fails, so there is one "no accent"
    // look rather than two.
    if (!coverAccentEnabled) {
      setNextGradient(NEUTRAL_GRADIENT);
      return;
    }
    if (!currentSong?.cover) return;
    // `grid` (420px), not `detail` (1200px). This image is never displayed —
    // it is downloaded, averaged into an accent gradient, and thrown away, and
    // averaging does not get better with resolution. At `detail` the app was
    // fetching a 1200px cover on every track change, which is the largest
    // per-track download in the app on a phone that is often on cellular.
    //
    // It also 404s more: Navidrome only generates 1200 for large originals,
    // as `buildCover` already notes for the MusicBrainz path.
    const uri = buildCover(currentSong.cover, 'grid');
    if (uri) extractColors(uri);
  }, [coverAccentEnabled, currentSong?.cover, currentSong?.localId, extractColors]);

  const handleFadeComplete = useCallback(() => {
    setCurrentGradient(nextGradient);
  }, [nextGradient]);

  // Android's back button collapses the player rather than leaving the screen
  // underneath it, the same as it did while this was a modal sheet.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      collapse();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, collapse]);

  // Where this host starts in the window, so the two measured slots can be
  // read in its coordinates. Measured rather than assumed to be the window's
  // origin: that assumption is what puts the cover out of its slot wherever
  // the host does not start at the very top of the window.
  const rootRef = useRef<View>(null);
  const measureHostOrigin = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      hostOrigin.value = { x, y };
    });
  }, [hostOrigin]);

  // Faded in over the first stretch of scrolling, and only while the player
  // is up: the dock and the screens below have their own status bar.
  const statusBarScrimStyle = useAnimatedStyle(() => ({
    opacity: expansion.value * interpolate(scrollY.value, [0, STATUS_SCRIM_FADE], [0, 1], Extrapolation.CLAMP),
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - expansion.value) * height }],
  }));

  // The screen's contents arrive after the surface has started rising, so the
  // cover is alone in the air for the first part of the travel — which is what
  // makes it read as the bar's artwork being carried up rather than as a new
  // screen that happens to have artwork on it.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0.15, 0.7], [0, 1], Extrapolation.CLAMP),
  }));

  // Resolved on the JS side and captured by the worklets below: the corner the
  // bar draws its thumbnail with, and the one the player draws its cover with.
  const barRadius = radius.sm;
  const cardRadius = rad.card;

  const coverStyle = useAnimatedStyle(() => {
    const from = barCover.value;
    const to = fullCover.value;
    const e = expansion.value;

    // Every branch returns the same style keys. Reanimated applies the shape
    // it saw first, so a short-circuit that returned only `opacity` left the
    // transform below permanently unapplied — the cover was positioned, sized
    // and simply never drawn.
    const ready = coverHandedOver(e, from, to);
    const scale = ready ? coverScale(from.size, to.size, e, REFERENCE_SIZE) : 1;

    // Both slots were measured against the window, and the row is drawn inside
    // this host. Subtracting where the host itself begins is what makes the
    // two agree: where it does not start at the window's origin, a raw window
    // rect lands the cover exactly that far out of its slot.
    const origin = hostOrigin.value;

    // The slot is measured with the player scrolled to the top, which is where
    // it always is when the player opens. Collapsing from a scrolled position
    // — the artist link, the hardware back button — would otherwise fly the
    // cover back from where the slot used to be rather than where it is.
    const toY = to.y - origin.y - scrollY.value;

    return {
      // `ready` is about the handover; coverVisibility is about whether the
      // screen underneath is showing the player at all. The queue is a list
      // that wants the whole screen, so the cover steps out of its way.
      opacity: ready ? coverVisibility.value : 0,
      transform: [
        {
          // The swipe offset is scaled by `e` so it is at full strength on the
          // open player and nothing at all in the dock: the same cover draws
          // both, and a half-collapsed player should not carry a drag with it.
          // Divided by `scale` because it is applied inside the scaled frame,
          // so a raw value would move by scale-times the distance the finger did.
          translateX:
            interpolate(e, [0, 1], [from.x - origin.x, to.x - origin.x], Extrapolation.CLAMP) +
            (coverSwipeX.value * e) / scale,
        },
        { translateY: interpolate(e, [0, 1], [from.y - origin.y, toY], Extrapolation.CLAMP) },
        { scale },
      ],
    };
  });

  // The corner radius belongs to each cover rather than to the row, because
  // the row must not clip: its neighbours sit outside it until a drag pulls
  // one in. Undone by the scale they are drawn inside, so the corner reads the
  // same size at both ends of the travel.
  const coverRadius = (expansionValue: number, scale: number) => {
    'worklet';
    // The resting corner is whatever the slot was drawn with: square for the
    // full-width player, the card's rounding otherwise.
    const restingRadius = fullCover.value.radius ?? cardRadius;
    return interpolate(expansionValue, [0, 1], [barRadius, restingRadius], Extrapolation.CLAMP) / scale;
  };

  // A neighbour rests a full window width away, not a cover width: the cover
  // is inset from the screen edges, so covers laid edge to edge would leave a
  // sliver of the next one showing beside the slot. Expressed in the scaled
  // frame's units, which is what the row is laid out in.
  const neighbourOffset = (scale: number) => {
    'worklet';
    return width / scale;
  };

  const boxScale = (expansionValue: number) => {
    'worklet';
    const from = barCover.value;
    const to = fullCover.value;
    return coverHandedOver(expansionValue, from, to)
      ? coverScale(from.size, to.size, expansionValue, REFERENCE_SIZE)
      : 1;
  };

  const currentCoverStyle = useAnimatedStyle(() => {
    const e = expansion.value;
    return { borderRadius: coverRadius(e, boxScale(e)) };
  });

  const previousCoverStyle = useAnimatedStyle(() => {
    const e = expansion.value;
    const scale = boxScale(e);
    return {
      borderRadius: coverRadius(e, scale),
      transform: [{ translateX: -neighbourOffset(scale) }],
    };
  });

  const nextCoverStyle = useAnimatedStyle(() => {
    const e = expansion.value;
    const scale = boxScale(e);
    return {
      borderRadius: coverRadius(e, scale),
      transform: [{ translateX: neighbourOffset(scale) }],
    };
  });

  return (
    <View
      ref={rootRef}
      onLayout={measureHostOrigin}
      style={StyleSheet.absoluteFill}
      pointerEvents={isOpen ? 'auto' : 'none'}
      // The dock underneath has to stay reachable whenever the player is not
      // covering it, and a full-screen view that only sometimes takes touches
      // is exactly the kind of thing screen readers should not announce.
      accessibilityElementsHidden={!isOpen}
      importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, surfaceStyle]}>
        <PlayingBackground
          style={StyleSheet.absoluteFill}
          current={currentGradient}
          next={nextGradient}
          onFadeComplete={handleFadeComplete}
        />
        <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
          {hasOpened ? <PlayingScreen onClose={collapse} /> : null}
        </Animated.View>
      </Animated.View>

      {/* The same component every other cover in the app goes through, so it
        * resolves against the active server, falls back the same way, and
        * shows the same placeholder when there is nothing to show. Building a
        * URL here by hand meant the host missed the server subscription that
        * makes those URLs resolve at all. */}
      {strip.current && (
        <Animated.View
          style={[
            styles.coverRow,
            { width: REFERENCE_SIZE, height: REFERENCE_SIZE },
            coverStyle,
          ]}
          pointerEvents="none"
        >
          {strip.previous && (
            <Animated.View style={[styles.coverBox, previousCoverStyle]}>
              <MediaImage cover={strip.previous} size="detail" style={styles.coverFill} />
            </Animated.View>
          )}

          <Animated.View style={[styles.coverBox, currentCoverStyle]}>
            <MediaImage cover={strip.current} size="detail" style={styles.coverFill} />
          </Animated.View>

          {strip.next && (
            <Animated.View style={[styles.coverBox, nextCoverStyle]}>
              <MediaImage cover={strip.next} size="detail" style={styles.coverFill} />
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Over the player and its cover, so neither scrolls into the clock or
        * the camera cutout legibly-illegibly. Invisible until the player has
        * scrolled, so the player at rest looks exactly as it did. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.statusBarScrim, { height: insets.top + spacing.xl }, statusBarScrimStyle]}
      >
        <LinearGradient colors={shade.statusBar} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverFill: {
    width: '100%',
    height: '100%',
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  coverRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Anchored top-left so translate places the square's corner exactly where
    // it was measured, and scale grows it away from that corner.
    transformOrigin: 'top left',
  },
  // Each cover fills the row and clips its own corners. The row itself cannot
  // clip, or the neighbours would be invisible until they were already inside
  // the slot — which is the swipe having nothing to show that this replaced.
  coverBox: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
