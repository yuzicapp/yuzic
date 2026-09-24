import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import { ALL_SOURCES } from './registry';

/*
 * Where a tapped album or artist goes, decided apart from the provider that
 * navigates: which record already says where it lives, and when the picker
 * is needed.
 */

type SourceDefinition = (typeof ALL_SOURCES)[number];

/** How many matches each source offers the picker, the first shown up front. */
export const CANDIDATES_PER_SOURCE = 5;

/** The provider id an already-external record was browsed through, if it says. */
export function providerIdOf(item: Album | Artist): string | undefined {
  return item.provenance.origin === 'integration' ? item.provenance.providerId : undefined;
}

type Sources = readonly SourceDefinition[];

/**
 * Where an artist already is, when the record says.
 *
 * An artist reached from an external album or artist page carries its
 * source's id, and searching for it by name threw that away: every enabled
 * source answered with its own best guess and the picker asked the listener
 * to choose between them, for an artist the app had just been showing.
 */
export function knownArtistRoute(item: Artist, enabledSources: Sources) {
  // Only among the sources the listener has switched on. Resolving `own` out
  // of ALL_SOURCES sent a Deezer-born artist to Deezer with Deezer turned
  // off — and because this runs before the "no sources enabled" check, that
  // guard could not be reached by any record carrying a source of its own.
  const own = enabledSources.find(s => s.id === providerIdOf(item));
  for (const source of own ? [own, ...enabledSources] : enabledSources) {
    const artistId = source.artistIdOf(item.externalIds) || (source === own ? item.nativeId : undefined);
    if (artistId) {
      return { source: source.id, artistId, mbid: item.externalIds.mbid, name: item.name };
    }
  }
  return null;
}

/** As `knownArtistRoute`, for an album browsed through a source. */
export function knownAlbumRoute(item: Album, enabledSources: Sources) {
  const own = enabledSources.find(s => s.id === providerIdOf(item));
  if (!own || !item.nativeId) return null;
  return { source: own.id, albumId: item.nativeId, artist: item.artist.name, title: item.title };
}

/**
 * Each source's matches, grouped for the picker, and whether it is needed.
 *
 * The picker opens only when more than one source answered, as it always
 * has; one source answering goes straight to its best match. What changed is
 * that it now carries each source's runners-up behind the first, so a wrong
 * top match is not the end of the road.
 */
export function pickFrom<T>(perSource: T[][]): { direct: T | null; all: T[] } {
  const answered = perSource.filter(list => list.length > 0);
  return {
    direct: answered.length === 1 ? answered[0][0] : null,
    all: answered.flat(),
  };
}
