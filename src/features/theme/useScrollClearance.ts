import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import { spacing } from '@/constants/design';
import { useActiveTheme } from './useActiveTheme';

/**
 * How much room a scrolling list should leave at its bottom.
 *
 * Normally just breathing room: the tab dock is laid out by react-navigation,
 * so screens already end at its top edge and don't have to account for it.
 *
 * With the translucent dock the tab bar is absolutely positioned and takes no
 * layout space — content runs underneath it, which is the point — so every
 * list has to reserve the dock's own height on top of that breathing room or
 * its last row sits behind the tabs forever.
 *
 * Reading the height from context rather than measuring it keeps the two in
 * step: the dock's height changes with the safe-area inset and with whether a
 * track is playing, and a hardcoded guess would be wrong on both counts.
 */
export function resolveBottomOverlayHeight(
  translucent: boolean,
  tabBarHeight: number | null | undefined
): number {
  if (!translucent || tabBarHeight == null) return 0;
  return tabBarHeight;
}

export function useBottomOverlayHeight(): number {
  const translucent = useActiveTheme().components.dock === 'translucent';
  // Null outside a tab navigator — modals and the onboarding stack render
  // without a dock, so nothing overlays their content.
  const tabBarHeight = useContext(BottomTabBarHeightContext);

  return resolveBottomOverlayHeight(translucent, tabBarHeight);
}

export function useScrollClearance(): number {
  return useBottomOverlayHeight() + spacing.scrollClearance;
}
