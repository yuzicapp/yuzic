import { useExternalResolution } from './externalResolutionContext';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';

export function useMatchedNavigation() {
  const { resolveAndNavigateToAlbum, resolveAndNavigateToArtist } = useExternalResolution();

  return {
    navigateToAlbum: (item: Album) => { void resolveAndNavigateToAlbum(item); },
    navigateToArtist: (item: Artist) => { void resolveAndNavigateToArtist(item); },
  };
}
