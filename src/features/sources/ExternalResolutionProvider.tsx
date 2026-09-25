import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { notify } from '@/components/toast';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import ExternalSourcePickerSheet, { type PickerItem } from '@/components/ExternalSourcePickerSheet';
import { useEnabledExternalSources, type SourceResolvedAlbum, type SourceResolvedArtist } from './registry';
import { CANDIDATES_PER_SOURCE, knownAlbumRoute, knownArtistRoute, pickFrom, providerIdOf } from './resolutionRoutes';
import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { matchAlbumToLibrary, matchArtistToLibrary } from '@/features/library/matchToLibrary';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';

const NO_SOURCE_TOAST = 'Enable an external source in Settings to browse this content.';

type ResolutionContextType = {
  resolveAndNavigateToAlbum: (item: Album) => void;
  resolveAndNavigateToArtist: (item: Artist) => void;
};

const ExternalResolutionContext = createContext<ResolutionContextType | null>(null);

export function useExternalResolution(): ResolutionContextType {
  const ctx = useContext(ExternalResolutionContext);
  if (!ctx) throw new Error('useExternalResolution must be used within ExternalResolutionProvider');
  return ctx;
}

export function ExternalResolutionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const enabledSources = useEnabledExternalSources();
  const { albums } = useAlbums();
  const { artists } = useArtists();

  const albumPickerRef = useRef<BottomSheetModal>(null);
  const artistPickerRef = useRef<BottomSheetModal>(null);
  const [albumPickerItems, setAlbumPickerItems] = useState<PickerItem[]>([]);
  const [artistPickerItems, setArtistPickerItems] = useState<PickerItem[]>([]);

  // Callers that want to bypass the library match (fuzzy false positives)
  // don't come through here — they push albumView/artistView directly with
  // forceExternal, which the unified screens honor.
  const resolveAndNavigateToAlbum = useCallback(async (item: Album) => {
    const localMatch = matchAlbumToLibrary(
      { externalIds: item.externalIds, title: item.title, artistName: item.artist.name },
      albums
    );
    if (localMatch) {
      // /albumView resolves this param by calling the server adapter
      // (useAlbum -> api.albums.get(id)), so it needs the origin's own id,
      // not the on-device localId.
      router.push({ pathname: '/albumView', params: { id: localMatch.nativeId } });
      return;
    }

    // Browsed through a source already: open it there, no search needed.
    const known = knownAlbumRoute(item, enabledSources);
    if (known) {
      router.push({ pathname: '/albumView', params: known });
      return;
    }

    const providerId = providerIdOf(item);

    if (enabledSources.length === 0) {
      notify.error(NO_SOURCE_TOAST);
      return;
    }

    // If only one source enabled and it matches the item's source, navigate directly
    if (enabledSources.length === 1 && (!providerId || enabledSources[0].id === providerId)) {
      router.push({ pathname: '/albumView', params: { source: providerId ?? enabledSources[0].id, albumId: item.nativeId, artist: item.artist.name, title: item.title } });
      return;
    }

    // Resolve across all enabled sources
    const { direct, all } = pickFrom<SourceResolvedAlbum>(await Promise.all(
      enabledSources.map(s => s.resolveAlbumCandidates(item.artist.name, item.title, CANDIDATES_PER_SOURCE).catch(() => []))
    ));

    if (all.length === 0) {
      notify.error('This album could not be found on any enabled source.');
      return;
    }
    if (direct) {
      router.push({ pathname: '/albumView', params: { source: direct.source, albumId: direct.id, artist: direct.artist, title: direct.title } });
      return;
    }
    setAlbumPickerItems(all.map(r => ({ ...r, kind: 'album' as const })));
    albumPickerRef.current?.present();
  }, [albums, enabledSources, router]);

  const resolveAndNavigateToArtist = useCallback(async (item: Artist) => {
    const localMatch = matchArtistToLibrary({ externalIds: item.externalIds, name: item.name }, artists);
    if (localMatch) {
      // Server adapter identity, same reasoning as the album branch above.
      router.push({ pathname: '/artistView', params: { id: localMatch.nativeId } });
      return;
    }

    // The record says which artist it is: go there rather than asking.
    const known = knownArtistRoute(item, enabledSources);
    if (known) {
      router.push({ pathname: '/artistView', params: known });
      return;
    }

    if (enabledSources.length === 0) {
      notify.error(NO_SOURCE_TOAST);
      return;
    }

    if (enabledSources.length === 1) {
      // No id for it (that is `knownArtistRoute`), so the screen resolves the
      // name. `mbid` only when the record has one: a native id is some other
      // origin's, and sending it as an mbid looks up nobody.
      router.push({ pathname: '/artistView', params: { source: enabledSources[0].id, mbid: item.externalIds.mbid, name: item.name } });
      return;
    }

    const { direct, all } = pickFrom<SourceResolvedArtist>(await Promise.all(
      enabledSources.map(s => s.resolveArtistCandidates(item.name, CANDIDATES_PER_SOURCE).catch(() => []))
    ));

    if (all.length === 0) {
      notify.error('This artist could not be found on any enabled source.');
      return;
    }
    if (direct) {
      router.push({ pathname: '/artistView', params: { source: direct.source, artistId: direct.id, name: direct.name } });
      return;
    }
    setArtistPickerItems(all.map(r => ({ ...r, kind: 'artist' as const })));
    artistPickerRef.current?.present();
  }, [artists, enabledSources, router]);

  /*
   * This provider wraps every tab and reads the whole catalog, so without the
   * memo its value changed identity on each sync and each picker open — and
   * its consumers are six Home shelves plus the Search model. That is the
   * re-render-all-of-Home shape `useStableList` was written to kill,
   * reintroduced one layer above it.
   */
  const value = useMemo(
    () => ({ resolveAndNavigateToAlbum, resolveAndNavigateToArtist }),
    [resolveAndNavigateToAlbum, resolveAndNavigateToArtist],
  );

  return (
    <ExternalResolutionContext.Provider value={value}>
      {children}
      <ExternalSourcePickerSheet
        ref={albumPickerRef}
        items={albumPickerItems}
        onSelect={item => {
          albumPickerRef.current?.dismiss();
          const artist = item.kind === 'album' ? item.artist : '';
          const title = item.kind === 'album' ? item.title : '';
          router.push({ pathname: '/albumView', params: { source: item.source, albumId: item.id, artist, title } });
        }}
      />
      <ExternalSourcePickerSheet
        ref={artistPickerRef}
        items={artistPickerItems}
        onSelect={item => {
          artistPickerRef.current?.dismiss();
          const artistName = item.kind === 'artist' ? item.name : '';
          router.push({ pathname: '/artistView', params: { source: item.source, artistId: item.id, name: artistName } });
        }}
      />
    </ExternalResolutionContext.Provider>
  );
}
