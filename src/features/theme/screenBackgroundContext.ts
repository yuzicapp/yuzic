import { createContext, useContext } from 'react';

/** The image showing behind the app right now, if any. */
export type BackgroundSurface = { uri: string; blur: number; dim: number };

/**
 * Deliberately a leaf: the context and nothing else.
 *
 * `useTheme` needs to know whether a background is showing, so it can report
 * the page colour as transparent and let it through. The *provider* needs the
 * playing track and the current route to work out what to show, and putting
 * both in one file made `useTheme` depend on playback and the router — a cycle
 * the architecture gate caught, and a reason every test rendering a themed
 * component would have needed a player and a navigator.
 */
export const BackgroundSurfaceContext = createContext<BackgroundSurface | null>(null);

/**
 * Whether a background is showing behind the current screen. Null without a
 * provider, so a component under test draws its ordinary opaque background.
 */
export function useScreenBackground(): BackgroundSurface | null {
  return useContext(BackgroundSurfaceContext);
}
