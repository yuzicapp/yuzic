import { listDensity } from '@/constants/design';
import { useActiveTheme } from './useActiveTheme';

/**
 * The vertical rhythm a list row should use, for the density the user picked.
 *
 * Only the rhythm: artwork and type stay the size they are at every density, so
 * "compact" is the same list standing closer together rather than a smaller
 * one. A row reads whichever of the three roles it is — `rowGap` if it stands
 * on its own, `rowPadding` if it sits flush against the next, `trackRowPadding`
 * if it is one of a record's worth of tracks.
 *
 * Under `default` these are the numbers rows had before the setting existed, so
 * nothing moves until the user asks it to.
 */
export function useListDensity() {
  return listDensity[useActiveTheme().shape.density];
}
