/**
 * Local first: one rule for "do I already have this?".
 *
 * A browsed record — a Deezer shelf album, a ListenBrainz mix track, an
 * external artist, a recommendation rail's song — may be a record the library
 * already holds in full. When it is, the app must present and play *its own
 * copy*: the full track rather than a thirty-second sample, the library screen
 * rather than the browse-only one, and no offer to acquire something already
 * owned.
 *
 * This is deliberately one rule rather than a check per surface, the same way
 * every artist and album picture became one rule in
 * `features/artwork/coverResolution`. Surfaces ask here; nobody matches by
 * hand. It invents no matching of its own either: the decision is
 * `domain/identity/matching`'s `findMatch` — identifiers first (mbid, isrc,
 * upc, deezerId), then a conservative normalized name pair — reached through
 * the `matchToLibrary` adapters, so "is this mine" answers the same way in
 * every corner of the app.
 *
 * **Why an index.** The adapters scan a list, which is fine for one lookup and
 * is not fine for a shelf: ten rows against a 4,673-track library is ten full
 * scans, on every render. `buildLibraryIndex` pays O(n) once per library
 * change and answers each row in O(1). A surface holds the index (memoised on
 * the library arrays it came from) and asks it per row.
 *
 * Deliberately pure — no React and no data hooks. `useLocalFirst` next door is
 * the component-facing half; keeping the rule itself free of them is what lets
 * a screen's test exercise it without mounting the provider registry (and the
 * i18n init behind it) that reading the catalog would drag in.
 */
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import { ID_FIELDS as MATCH_ID_FIELDS, normalizeName } from '@/domain/identity/matching';

/**
 * Identifier fields that can carry an exact match, strongest first.
 *
 * Taken from the domain matcher rather than written out again: that list is
 * the rule, and a second copy here would be a second place to update when a
 * source's identifier joins it.
 */
const ID_FIELDS = MATCH_ID_FIELDS.map(([, field]) => field);

interface Indexed<T> {
  entity: T;
  mbidType?: 'release' | 'release-group';
}

/** What a caller must describe to be looked up: the ids it carries, and the
 *  name pair the fallback compares (an artist has no secondary). */
interface Subject {
  externalIds: ExternalIds;
  primary: string;
  secondary?: string;
}

/** One kind's index: an entry per identifier value, plus one per name pair. */
interface EntityIndex<T> {
  readonly size: number;
  find(subject: Subject): T | null;
}

/**
 * A separator no title or artist name can contain, so a pair can only ever
 * key as that pair. Joined by a space, "Black Star" by "Radiohead" and
 * "Black" by "Star Radiohead" produce the same key, and the second would
 * then match the first.
 */
const NAME_KEY_SEPARATOR = '\u0000';

const nameKeyOf = (primary: string, secondary?: string): string =>
  `${normalizeName(primary)}${NAME_KEY_SEPARATOR}${secondary === undefined ? '' : normalizeName(secondary)}`;

function buildIndex<T>(
  items: readonly T[],
  read: (item: T) => { externalIds: ExternalIds; primary: string; secondary?: string }
): EntityIndex<T> {
  const byId = new Map<string, Indexed<T>>();
  const byName = new Map<string, T>();

  for (const item of items) {
    const { externalIds, primary, secondary } = read(item);
    for (const field of ID_FIELDS) {
      const value = externalIds[field];
      if (!value) continue;
      const key = `${field}:${value}`;
      // First writer wins: a library that somehow holds the same identifier
      // twice keeps the earlier record rather than flipping between them.
      if (!byId.has(key)) byId.set(key, { entity: item, mbidType: externalIds.mbidType });
    }
    const key = nameKeyOf(primary, secondary);
    if (!byName.has(key)) byName.set(key, item);
  }

  return {
    size: items.length,
    find(subject: Subject): T | null {
      for (const field of ID_FIELDS) {
        const value = subject.externalIds[field];
        if (!value) continue;
        const hit = byId.get(`${field}:${value}`);
        if (!hit) continue;
        // A release id and a release-group id are different things; comparing
        // them is how an album gets matched to its own boxed set.
        if (
          field === 'mbid' &&
          subject.externalIds.mbidType &&
          hit.mbidType &&
          subject.externalIds.mbidType !== hit.mbidType
        ) continue;
        return hit.entity;
      }
      return byName.get(nameKeyOf(subject.primary, subject.secondary)) ?? null;
    },
  };
}

export interface LibraryIndex {
  songs: EntityIndex<Song>;
  albums: EntityIndex<Album>;
  artists: EntityIndex<Artist>;
}

/** Builds the three indexes. Pure — the hook below memoises it; tests call it
 *  directly. */
export function buildLibraryIndex(library: {
  songs: readonly Song[];
  albums: readonly Album[];
  artists: readonly Artist[];
}): LibraryIndex {
  return {
    songs: buildIndex(library.songs, song => ({
      externalIds: song.externalIds,
      primary: song.title,
      secondary: song.artist.name,
    })),
    albums: buildIndex(library.albums, album => ({
      externalIds: album.externalIds,
      primary: album.title,
      secondary: album.artist.name,
    })),
    artists: buildIndex(library.artists, artist => ({
      externalIds: artist.externalIds,
      primary: artist.name,
    })),
  };
}

/** True for a record that came from a catalogue rather than the user's own
 *  server — the only kind there is anything to resolve for. */
const isExternal = (entity: { provenance: { origin: string } }): boolean =>
  entity.provenance.origin === 'integration';

/**
 * The library's own copy of a browsed song, or null.
 *
 * Null for a record that is already the library's — asking "do I have this?"
 * of your own track is a question with a misleading answer (it would match
 * itself), so callers get null and keep what they had.
 */
export function localSong(index: LibraryIndex, song: Song): Song | null {
  if (!isExternal(song)) return null;
  return index.songs.find({
    externalIds: song.externalIds,
    primary: song.title,
    secondary: song.artist.name,
  });
}

export function localAlbum(index: LibraryIndex, album: Album): Album | null {
  if (!isExternal(album)) return null;
  return index.albums.find({
    externalIds: album.externalIds,
    primary: album.title,
    secondary: album.artist.name,
  });
}

export function localArtist(index: LibraryIndex, artist: Artist): Artist | null {
  if (!isExternal(artist)) return null;
  return index.artists.find({ externalIds: artist.externalIds, primary: artist.name });
}

/** A browsed song replaced by the library's copy where there is one — what a
 *  row renders and what the player is handed. */
export function preferLocalSong(index: LibraryIndex, song: Song): Song {
  return localSong(index, song) ?? song;
}
