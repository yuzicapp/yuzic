import { hitSlopFor, iconSize, motion, onDark, spacing, typography } from '@/constants/design';
import React, { useCallback, useMemo, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useAnimatedReaction, runOnJS, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import {
  usePlayingState,
  usePlayingActions,
  usePlayingQueueVersion,
} from '@/features/playback/PlayingContext';
import { coverNeighbours } from '../coverNeighbours';
import PlayingProgressSection from './PlayingProgress';
import PlayingRating from './PlayingRating';
import type { CoverStrip } from '@/features/player/PlayerExpansion';
import { useSelector } from 'react-redux';
import { selectShowQualityBadge } from '@/features/settings/appearance/state';
import { hasDuration } from '@/domain/playback/ContentKind';
import { CirclePlus } from 'lucide-react-native';
import { usePlayerExpansion } from '@/features/player/PlayerExpansion';
import { resolveCoverSwipe } from '../coverSwipe';
import { isAtRest, measurementHeldStill, restingSlotY } from '../coverSlotMeasurement';
import { canStartCoverSlide } from '../coverTransition';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import type { PlayerLayout } from '../playerLayout';

type PlayingMainProps = {
  /**
   * Where the artwork and the column beside it go — see `playerLayout`.
   * Everything this component sizes comes from here rather than from the
   * window, so the one screen that decides the shape is the one that knows
   * what is above and below it.
   */
  layout: PlayerLayout;
  onPressArtist?: () => void;
  onPressOptions?: () => void;
  onPressAdd?: () => void;
  /**
   * The transport row, handed in rather than rendered here.
   *
   * It belongs under the title in both shapes, and in the split one "under
   * the title" is inside the right-hand column — so the column has to own it.
   * The alternative was for the screen to place it and for the two of them to
   * agree about the column's width twice.
   */
  children?: ReactNode;
};

// A swipe is unreachable with a screen reader on, so the same two outcomes are
// offered as named actions. `increment`/`decrement` are what an `adjustable`
// role advertises, which is how VoiceOver and TalkBack already expect to move
// through a value.
const SWIPE_A11Y_ACTIONS = [
  { name: 'increment' as const },
  { name: 'decrement' as const },
];

const PlayingMain: React.FC<PlayingMainProps> = ({
  layout,
  onPressArtist,
  onPressOptions,
  onPressAdd,
  children
}) => {
  const { coverSize, columnWidth, rowWidth, columnGap } = layout;
  const split = layout.mode === 'split';
  const inline = layout.inline;
  const { t } = useTranslation();
  const { currentSong, currentIndex, repeatMode } = usePlayingState();
  const { skipToNext, skipToPrevious, getQueue } = usePlayingActions();
  const currentSongId = currentSong?.localId;
  const currentCover = currentSong?.cover ?? null;
  const queueLength = getQueue().length;
  const queueVersion = usePlayingQueueVersion();
  // How far the row travels to bring a neighbour in. A window width, not a
  // cover width: the cover is inset from the screen edges, so that is where
  // the host rests the next one — and a shorter travel would land it beside
  // the slot rather than in it.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rad = useRadius();

  // Handed to the host as the swipe is accepted, so the row it is drawing is
  // held still while the skip commits: the queue moves the instant playback
  // takes the command, and re-deriving it mid-flight would change the picture
  // under the finger.
  const strip = useMemo<CoverStrip>(
    () => ({ current: currentCover, ...coverNeighbours(getQueue(), currentIndex, repeatMode) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `queueVersion` is what says the queue changed
    [currentCover, currentIndex, repeatMode, getQueue, queueVersion],
  );
  const showQualityBadge = useSelector(selectShowQualityBadge);
  const { expansion, fullCover, scrollY, coverSwipeX, beginCoverSlide } = usePlayerExpansion();

  // The cover itself is drawn by the player host, one layer up, so a single
  // image can travel between here and the playing bar instead of one being
  // swapped for another. What is left here is the hole it lands in, and the
  // job of telling the host where that hole is.
  const coverSlotRef = useRef<View>(null);
  const measureCoverSlot = useCallback(() => {
    // Where the surface was when the question was asked. The undo below has
    // to be against this expansion rather than whatever it has become by the
    // time the answer comes back.
    const askedAt = expansion.value;
    coverSlotRef.current?.measureInWindow((x, y, slotWidth) => {
      if (slotWidth <= 0) return;
      // `measureInWindow` reports where the slot is *right now*, and right now
      // the player's surface is usually somewhere it will not stay: it is
      // translated down by a whole screen height while closed, and the list
      // under it may be scrolled. Taken raw, a measurement made at any moment
      // but a settled, unscrolled open stored a slot roughly one screen below
      // where the cover would be drawn — so the artwork flew off the screen
      // and only snapped into place once the player landed and re-measured.
      // That is the first open of a session, which never had a corrected rect
      // to use, and it is why every later open looked right.
      //
      // Undo both, so the rect always means "where the slot sits when the
      // player is open and unscrolled" no matter when it was taken.
      //
      // Only if `y` and the expansion it is undone against are the same
      // moment, though. `measureInWindow` answers a frame or more later, and
      // the spring is at its fastest exactly as it passes 1 — so a
      // measurement taken across any movement is skewed by the surface travel
      // between the two, which is points rather than rounding. Drop it and
      // let the reaction below take another once the spring is still; that is
      // the small correction that used to land under the eye as the artwork
      // settled.
      if (!measurementHeldStill(askedAt, expansion.value)) return;
      fullCover.value = {
        x,
        y: restingSlotY(y, expansion.value, windowHeight, scrollY.value),
        size: slotWidth,
      };
    });
  }, [fullCover, expansion, scrollY, windowHeight]);

  // Re-measure when the player comes to rest at either end: the lyrics preview
  // and the optional cards arrive after the first layout and can move this.
  // Safe at both ends now that the measurement undoes the surface offset
  // itself — before that, measuring while closed stored a slot a screen too
  // low and broke the very next open.
  //
  // "At rest" is a band around each end, not `>= 1`: `PLAYER_SPRING` does not
  // clamp its overshoot, so the player passes 1 at its highest speed and
  // stays above it for the whole ring-down. Treating that as arrived measured
  // the slot mid-flight — and since the spring crosses back through the band
  // on its way to settling, the accurate measurement arrived second and moved
  // the artwork after it had apparently landed.
  useAnimatedReaction(
    () => isAtRest(expansion.value),
    (atRest, wasAtRest) => {
      if (atRest && atRest !== wasAtRest) runOnJS(measureCoverSlot)();
    },
    [measureCoverSlot],
  );

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === 'increment') void skipToNext();
      else if (event.nativeEvent.actionName === 'decrement') void skipToPrevious();
    },
    [skipToNext, skipToPrevious],
  );

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal only. The player's own drag-to-close pan and the scroll
        // view underneath both want vertical movement, so this one refuses it
        // outright rather than racing them for it: without the Y limit a
        // diagonal drag can start a skip and close the player at once.
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onUpdate(event => {
          coverSwipeX.value = event.translationX;
        })
        .onEnd(event => {
          const outcome = resolveCoverSwipe(event.translationX, event.velocityX, coverSize);
          if (
            !currentSongId || outcome === 'cancel' ||
            !canStartCoverSlide(outcome, currentIndex, queueLength, repeatMode)
          ) {
            coverSwipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
            return;
          }
          // Freeze the row first, then carry it exactly one cover across, so
          // the neighbour the finger already pulled into view is the one that
          // lands. The skip follows the animation rather than racing it: the
          // queue moving mid-slide is what made the old implementation recoil
          // instead of reading as a carousel.
          runOnJS(beginCoverSlide)(outcome, currentSongId, strip);
          coverSwipeX.value = withTiming(
            outcome === 'next' ? -windowWidth : windowWidth,
            { duration: motion.swipe },
            finished => {
              if (finished) runOnJS(outcome === 'next' ? skipToNext : skipToPrevious)();
            },
          );
        }),
    [
      beginCoverSlide, coverSwipeX, strip, currentIndex, currentSongId,
      queueLength, repeatMode, skipToNext, skipToPrevious, coverSize, windowWidth,
    ],
  );

  if (!currentSong) {
    return null;
  }
  const qualityLabel = (() => {
    const parts: string[] = [];
    const audio = currentSong.audio;
    if (audio?.mimeType) {
      const fmt = audio.mimeType.split('/')[1]?.toUpperCase().replace('MPEG', 'MP3').replace('X-FLAC', 'FLAC') ?? '';
      if (fmt) parts.push(fmt);
    }
    if (audio?.bitrateKbps) parts.push(`${audio.bitrateKbps}kbps`);
    else if (audio?.sampleRateHz) parts.push(`${(audio.sampleRateHz / 1000).toFixed(1)}kHz`);
    return parts.join(' · ') || null;
  })();

  const cover = (
    <GestureDetector gesture={swipe}>
      <View
        ref={coverSlotRef}
        onLayout={measureCoverSlot}
        // Keeps its surface colour rather than going transparent: the
        // travelling cover lands exactly on top of it, and a song whose
        // artwork will not load still has the plain square it always had
        // instead of a hole where the cover should be.
        style={[
          styles.cover,
          // Stacked, the gap below the artwork is the gap before the title.
          // Split, the title is beside it and the gap is the column's, so a
          // margin here would only push the square off centre.
          split || inline ? styles.coverBeside : styles.coverAbove,
          inline && styles.coverInline,
          { width: coverSize, height: coverSize, borderRadius: rad.card },
        ]}
        // The square is what the finger swipes, but the cover the eye
        // follows is drawn by the host with pointerEvents="none" — so this
        // is also what a screen reader finds. Name it for what it does.
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('a11y.player.coverArt')}
        accessibilityActions={SWIPE_A11Y_ACTIONS}
        onAccessibilityAction={handleAccessibilityAction}
      />
    </GestureDetector>
  );

  const details = (
    <View style={{ width: columnWidth }}>
      <View style={[styles.titleRow, inline && styles.titleRowInline]}>
        {inline && cover}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {currentSong.title}
          </Text>

          {currentSong.artist.name && (
            <Touchable
              accessibilityRole="link"
              accessibilityHint={t('a11y.player.goToArtist')}
              onPress={onPressArtist}
            >
              <Text style={styles.artist} numberOfLines={1}>
                {currentSong.artist.name}
              </Text>
            </Touchable>
          )}
        </View>

        <View>
          <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.player.addToPlaylist')}
          onPress={onPressAdd}
          style={styles.optionsButton}
          hitSlop={hitSlopFor(iconSize.large)}
        >
          <CirclePlus
            size={iconSize.large}
            color={onDark.text}
          />
        </Touchable>
        </View>
      </View>

      <PlayingRating song={currentSong} />

      {showQualityBadge && qualityLabel && (
        <Text style={styles.qualityBadge} numberOfLines={1}>
          {qualityLabel}
        </Text>
      )}

      {/* Progress + timestamps only make sense for a finite piece of audio.
       * A radio station's position is meaningless, and the "-0:00 remaining"
       * label under an infinite stream reads as broken. */}
      {hasDuration(currentSong.contentKind) && (
        <PlayingProgressSection songDuration={currentSong.durationSeconds} />
      )}

      {children}
    </View>
  );

  // Two shapes of the same four things. The row is centred on the taller of
  // its two halves rather than stretched: in a short window the column is
  // what sets the height, and a cover stretched to match it would no longer
  // be square.
  // Compact: the cover is already inside the title row, so the column is all.
  if (inline) {
    return <View style={[styles.root, { width: rowWidth }]}>{details}</View>;
  }

  return split ? (
    <View style={[styles.splitRoot, { width: rowWidth, columnGap }]}>
      {cover}
      {details}
    </View>
  ) : (
    <View style={[styles.root, { width: rowWidth }]}>
      {cover}
      {details}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
  },
  splitRoot: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    backgroundColor: onDark.surface,
  },
  coverAbove: {
    marginBottom: spacing.lg,
    // Centred in the column: the compact player's cover is narrower than it.
    alignSelf: 'center',
  },
  coverBeside: {
    marginBottom: 0,
  },
  // Beside the title, with the title's own gap to its right.
  coverInline: {
    marginRight: spacing.lg,
  },
  titleRowInline: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: onDark.text,
    marginBottom: spacing.xs,
  },
  artist: {
    ...typography.rowSubtitle,
    color: onDark.subtext,
  },
  qualityBadge: {
    ...typography.micro,
    color: onDark.mutedText,
    textAlign: 'left',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  optionsButton: {
    padding: spacing.tight,
  },
});

export default PlayingMain;
