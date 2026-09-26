import { useMemo } from 'react';
import { iconSize } from '@/constants/design';
import { useTextScale } from './textScale';

/**
 * Icon sizes at the user's text size.
 *
 * An icon beside a line of text is part of that line. With the type scale
 * live, a row's title grew by a third at the largest size while the chevron,
 * the heart and the ⋯ beside it stayed exactly where they were, and the
 * balance every row was drawn with went with it.
 *
 * Read the roles here wherever the icon sits *with content* — a row, a badge,
 * something inline with a sentence. The structural ones stay imported from
 * `constants/design`, the same split {@link useRadius} makes: an icon in the
 * dock or on the playing bar belongs to a strip of fixed height that the rest
 * of the app is measured against, so it holds still for the same reason those
 * labels do.
 *
 * At the default size these are the same numbers as the static `iconSize`, so
 * a call site moving to the hook does not change until the user asks it to.
 */
type ScaledIconSize = typeof iconSize;

export function useIconSize(): ScaledIconSize {
  const scale = useTextScale();
  return useMemo(() => {
    if (scale === 1) return iconSize;
    return Object.fromEntries(
      Object.entries(iconSize).map(([role, size]) => [role, Math.round(size * scale)]),
    ) as ScaledIconSize;
  }, [scale]);
}
