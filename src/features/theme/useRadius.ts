import { useMemo } from 'react';
import { radius, scaleRadius } from '@/constants/design';
import { useActiveTheme } from './useActiveTheme';

/**
 * Live radius values scaled by the user's preset.
 *
 * Consumers of the shape-defining tokens (`thumb`/`md`/`card`/`lg`/`panel`/
 * `pill`) should read them here so a preset change re-renders them with new
 * corners. The structural nudges (`xs`/`sm`) stay imported from
 * `constants/design` — a progress fill's corner is not shape the user picked.
 *
 * Under `default` these are the same numbers as the static `radius` export,
 * so a component migrating to the hook doesn't visually change until the user
 * picks a different preset.
 */
type ScaledRadius = {
  thumb: number;
  md: number;
  card: number;
  lg: number;
  panel: number;
  /**
   * Round, at every preset. For the things whose roundness is what they *are*
   * — an avatar, a status dot, a radio fill, a progress track, an artist's
   * photo. A squared status dot is not a sharper status dot, it is a different
   * component, and a squared progress track reads as a rendering bug.
   *
   * A **control** that happens to be drawn as a pill is not one of these. Its
   * roundness is the app's shape language rather than its identity, so it uses
   * {@link ScaledRadius.pillFor} and moves with the preset like everything
   * else.
   */
  pill: number;
  /**
   * The corner of a control drawn as a pill or a circle, given its height.
   *
   * Half the height is exactly a pill, so `default` returns what the control
   * already looked like, and `rounded` overshoots into the clamp React Native
   * applies at half the shorter side — still a pill. Only `sharp` moves it,
   * into the soft-cornered square the preset asks the cards for. The play
   * button and the buttons on the bar above it used to sit at a flat 999 and
   * stayed perfectly circular while every surface around them squared up,
   * which read as the preset half-applying rather than as a decision.
   */
  pillFor: (size: number) => number;
};

export function useRadius(): ScaledRadius {
  const preset = useActiveTheme().shape.radius;
  return useMemo(
    () => ({
      thumb: scaleRadius(radius.thumb, preset),
      md: scaleRadius(radius.md, preset),
      card: scaleRadius(radius.card, preset),
      lg: scaleRadius(radius.lg, preset),
      panel: scaleRadius(radius.panel, preset),
      pill: scaleRadius(radius.pill, preset),
      pillFor: (size: number) => scaleRadius(size / 2, preset),
    }),
    [preset],
  );
}
