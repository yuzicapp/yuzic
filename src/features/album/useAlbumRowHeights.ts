import { useMemo } from 'react';

import { listDensity } from '@/constants/design';
import { useListDensity } from '@/features/theme/useListDensity';
import { useTextScale } from '@/features/theme/textScale';
import { ALBUM_DISC_HEADER_HEIGHT, ALBUM_ESTIMATED_ROW_HEIGHT } from './constants';

/**
 * What the album's list should expect a row to measure.
 *
 * These feed `overrideItemLayout`, which is how the list places a scroll
 * position and how `scrollToIndex` finds a track. They were two constants
 * written for the default text size and density, and both of those can now
 * change while the app is running: at the largest size with spacious rows a
 * track row is nearer 100pt than 72, so the list placed every scroll and every
 * jump progressively further from where it meant to.
 *
 * The baseline is still the measured default; the text size scales it, and the
 * density is the difference in padding above and below, counted once for each.
 */
export function useAlbumRowHeights(): { track: number; discHeader: number } {
  const density = useListDensity();
  const scale = useTextScale();

  return useMemo(() => {
    const extraPadding = (density.trackRowPadding - listDensity.default.trackRowPadding) * 2;
    return {
      track: Math.round(ALBUM_ESTIMATED_ROW_HEIGHT * scale) + extraPadding,
      // No artwork and no second line, so only the type moves it.
      discHeader: Math.round(ALBUM_DISC_HEADER_HEIGHT * scale),
    };
  }, [density.trackRowPadding, scale]);
}
