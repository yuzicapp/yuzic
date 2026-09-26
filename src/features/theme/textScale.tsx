import React, { createContext, useContext, useMemo } from 'react';

import { typography } from '@/constants/design';
import { useActiveTheme } from './useActiveTheme';

/**
 * The user's text size, published once for everything that draws at it.
 *
 * Both the text itself (`components/Text`) and the icons beside it
 * (`useIconSize`) read from here rather than from the store, for two reasons:
 * 400-odd `Text`s should not each hold a store subscription, and a default of
 * 1 without a provider means a component under test draws at its written size
 * without the test having to stand up a store to say so.
 */
const TextScaleContext = createContext(1);

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const scale = useActiveTheme().shape.textScale;
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

export function useTextScale(): number {
  return useContext(TextScaleContext);
}

/**
 * The type roles at the size they are actually drawn.
 *
 * `typography` holds the written sizes; `components/Text` multiplies them as it
 * draws. Anything that needs the drawn number rather than a rendered string —
 * a loading placeholder standing in for a line of text, say — has to do the
 * same multiplication, and this is it in one place.
 */
export function useDrawnTypography(): typeof typography {
  const scale = useTextScale();
  return useMemo(() => {
    if (scale === 1) return typography;
    return Object.fromEntries(
      Object.entries(typography).map(([role, style]) => [
        role,
        { ...style, fontSize: Math.round(style.fontSize * scale), lineHeight: Math.round(style.lineHeight * scale) },
      ]),
    ) as typeof typography;
  }, [scale]);
}
