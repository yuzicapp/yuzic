import { createContext, useContext } from 'react';
import type { RoutableAlbum, RoutableArtist } from './resolutionRoutes';

/**
 * The seam between "something was tapped" and "the provider works out where
 * it lives".
 *
 * Separate from `ExternalResolutionProvider` on purpose, and the reason is
 * mechanical rather than aesthetic: that module pulls in the bottom-sheet
 * picker, the source registry and the whole catalog through `useAlbums` and
 * `useArtists`. Consumers only need to *call* the resolution, and a hook that
 * dragged all of it along took three test suites down with transform errors
 * the moment an action hook imported it. Context and hook here, nothing
 * heavy; the component that provides them stays where it is.
 */
type ResolutionContextType = {
  resolveAndNavigateToAlbum: (item: RoutableAlbum) => void;
  resolveAndNavigateToArtist: (item: RoutableArtist) => void;
};

export const ExternalResolutionContext = createContext<ResolutionContextType | null>(null);

export function useExternalResolution(): ResolutionContextType {
  const ctx = useContext(ExternalResolutionContext);
  if (!ctx) throw new Error('useExternalResolution must be used within ExternalResolutionProvider');
  return ctx;
}
