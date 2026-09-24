import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CoverSource } from '@/domain/entities/Cover';
import type { CoverSlideDirection } from '@/features/player/coverTransition';
import {
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  runOnJS,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Where the player is between the playing bar and the full screen.
 *
 * `0` is the bar in the dock, `1` is the full-screen player, and every value
 * between is a real position the user's finger can hold it at — which is the
 * whole point of owning this rather than presenting a modal. One shared value
 * drives the surface rising, the bar's contents fading out, the player's
 * fading in, and the cover art travelling between the two.
 */

/** A square of cover art, in window coordinates. */
/** Where a cover sits, and, for the player's, the corner it is drawn with there. */
type CoverRect = { x: number; y: number; size: number; radius?: number };

const EMPTY_COVER_RECT: CoverRect = { x: 0, y: 0, size: 0 };

/**
 * Snappy enough to feel like it is following the finger that let go, soft
 * enough not to ring. Shared by every path that lets go of the player — tap,
 * flick, and the close button — so they all land the same way.
 */
export const PLAYER_SPRING: WithSpringConfig = {
  damping: 24,
  stiffness: 240,
  mass: 0.85,
  overshootClamping: false,
};

/** Below this the player counts as closed: the bar owns its own cover again
 *  and the host stops taking touches. Not exactly zero, so a spring settling
 *  through 0.0001 doesn't flicker the handover. */
const CLOSED_EPSILON = 0.001;

/**
 * Whether the host has taken the cover over from the bar.
 *
 * Both ends of the handover have to agree about this exactly, and they used to
 * decide it separately: the bar dropped its thumbnail as soon as `expansion`
 * left zero, while the host would only draw the travelling cover once *both*
 * slots had been measured. On the very first drag the player screen has only
 * just been mounted by `prepare`, so its slot is still unmeasured for a frame
 * or two — and in that window the bar had already let go of a cover the host
 * could not yet draw, leaving the artwork missing at the exact moment the
 * gesture starts. One worklet, read by both sides, so there is no window.
 */
export function coverHandedOver(
  expansion: number,
  bar: CoverRect,
  full: CoverRect,
): boolean {
  'worklet';
  return expansion > CLOSED_EPSILON && bar.size > 0 && full.size > 0;
}

/**
 * The artwork the player draws: the playing track's, and the two a swipe can
 * reach. Rendered as one row, so dragging reveals the real neighbour instead
 * of empty space — which is what makes it a carousel rather than a recoil.
 */
export type CoverStrip = {
  previous: CoverSource | null;
  current: CoverSource | null;
  next: CoverSource | null;
};

export const EMPTY_COVER_STRIP: CoverStrip = { previous: null, current: null, next: null };

type CoverSlideState = {
  direction: CoverSlideDirection;
  /** The track that was playing when the finger let go. */
  outgoingSongId: string;
  /**
   * The covers as they were at that moment, held still until playback has
   * actually changed track. The queue moves under us the instant the skip
   * commits, and re-deriving the row mid-flight would swap the picture the
   * user is watching slide.
   */
  strip: CoverStrip;
};

type PlayerExpansionValue = {
  /** 0 = collapsed to the bar, 1 = full screen. */
  expansion: SharedValue<number>;
  /** Where the bar draws its thumbnail, measured in window coordinates. */
  barCover: SharedValue<CoverRect>;
  /** Where the full player draws its cover, measured in window coordinates. */
  fullCover: SharedValue<CoverRect>;
  /** How far the full player's scroll view is from its top. The drag-to-collapse
   *  gesture reads this to know whether the finger should move the player or
   *  the list under it. */
  scrollY: SharedValue<number>;
  /**
   * How visible the travelling cover should be, on top of wherever the
   * handover has put it.
   *
   * The cover is drawn by the host, above the player screen, so the screen
   * cannot fade it with its own contents — and swapping the player for the
   * queue left a full-width square of artwork sitting over the list. The
   * screen writes this on its way in and out of the queue; the host multiplies
   * it into the cover's opacity.
   */
  coverVisibility: SharedValue<number>;
  /**
   * Horizontal offset of the travelling cover while it is being swiped, in
   * screen points. Lives here rather than on the playing screen because the
   * cover itself is drawn by the host: the screen owns the *gesture* and the
   * host owns the *view*, so the offset has to cross between them.
   */
  coverSwipeX: SharedValue<number>;
  /**
   * Where the host draws the cover from, in window coordinates.
   *
   * Both slots are measured with `measureInWindow`, but the cover is drawn
   * inside the host's own view — so the two only agree where that view starts
   * at the window's origin. Subtracting this makes the rects mean the same
   * thing on every platform instead of relying on that being true.
   */
  hostOrigin: SharedValue<{ x: number; y: number }>;
  /** The frozen row for a skip that is in flight, or null between swipes. */
  coverSlide: CoverSlideState | null;
  beginCoverSlide: (direction: CoverSlideDirection, songId: string, strip: CoverStrip) => void;
  finishCoverSlide: () => void;
  expand: () => void;
  collapse: () => void;
  /** True from the moment the player starts opening until it is fully closed.
   *  Drives hit-testing and the hardware back handler, both of which are JS. */
  isOpen: boolean;
  /** True once the player has been opened at all. The screen is built on
   *  first use and kept, rather than built for everyone who never opens it. */
  hasOpened: boolean;
  /** Build the player screen now, without opening it — called as a drag on the
   *  bar begins, so the tree is ready by the time the finger has moved. */
  prepare: () => void;
};

const PlayerExpansionContext = createContext<PlayerExpansionValue | undefined>(undefined);

export const usePlayerExpansion = (): PlayerExpansionValue => {
  const ctx = useContext(PlayerExpansionContext);
  if (!ctx) throw new Error('usePlayerExpansion must be used within PlayerExpansionProvider');
  return ctx;
};

/**
 * Whether the full player is open, for surfaces that can render outside the
 * provider as well as inside it (the toast host is mounted within it in the
 * app, alone in its tests). False with no provider, where no player exists.
 */
export const usePlayerIsOpen = (): boolean => useContext(PlayerExpansionContext)?.isOpen ?? false;

export const PlayerExpansionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const expansion = useSharedValue(0);
  const barCover = useSharedValue<CoverRect>(EMPTY_COVER_RECT);
  const fullCover = useSharedValue<CoverRect>(EMPTY_COVER_RECT);
  const scrollY = useSharedValue(0);
  const coverVisibility = useSharedValue(1);
  const coverSwipeX = useSharedValue(0);
  const hostOrigin = useSharedValue({ x: 0, y: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [coverSlide, setCoverSlide] = useState<CoverSlideState | null>(null);

  const beginCoverSlide = useCallback(
    (direction: CoverSlideDirection, songId: string, strip: CoverStrip) => {
      setCoverSlide({ direction, outgoingSongId: songId, strip });
    },
    [],
  );
  const finishCoverSlide = useCallback(() => setCoverSlide(null), []);

  // One place decides what "open" means, so a tap, a drag that never
  // completed, and a spring settling back to zero all agree about it.
  useAnimatedReaction(
    () => expansion.value > CLOSED_EPSILON,
    (open, wasOpen) => {
      if (open !== wasOpen) runOnJS(setIsOpen)(open);
    },
    [],
  );

  const prepare = useCallback(() => setHasOpened(true), []);

  const expand = useCallback(() => {
    setHasOpened(true);
    setIsOpen(true);
    expansion.value = withSpring(1, PLAYER_SPRING);
  }, [expansion]);

  const collapse = useCallback(() => {
    expansion.value = withSpring(0, PLAYER_SPRING);
  }, [expansion]);

  const value = useMemo<PlayerExpansionValue>(
    () => ({
      expansion,
      barCover,
      fullCover,
      scrollY,
      coverVisibility,
      coverSwipeX,
      hostOrigin,
      coverSlide,
      beginCoverSlide,
      finishCoverSlide,
      expand,
      collapse,
      isOpen,
      hasOpened,
      prepare,
    }),
    [
      expansion, barCover, fullCover, scrollY, coverVisibility, coverSwipeX,
      hostOrigin, coverSlide, beginCoverSlide, finishCoverSlide,
      expand, collapse, isOpen, hasOpened, prepare,
    ],
  );

  return (
    <PlayerExpansionContext.Provider value={value}>
      {children}
    </PlayerExpansionContext.Provider>
  );
};
