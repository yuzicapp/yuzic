import { matchAlbumToLibrary, matchArtistToLibrary } from '@/features/library/matchToLibrary';
import { normalizeExternalIds } from '@/domain/identity/ExternalIds';
import { normalizeName } from '@/domain/identity/matching';
import type { Want } from '@/state/redux/slices/wantsSlice';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';

/**
 * The minimal library snapshot arrival detection needs: albums and artists are
 * matched via the shared `matchAlbumToLibrary` / `matchArtistToLibrary`
 * matchers, tracks (when supplied) via normalized title+artist — the same
 * `normalizeName` the domain matcher uses, no new fuzzy algorithm.
 */
interface ArrivalLibrary {
  albums: Album[];
  artists?: Artist[];
  tracks?: Song[];
}

/**
 * Where a want's arrival landed, so the notification can open it.
 *
 * Two kinds cover all three units: a track want opens the album that holds it,
 * because a library track has no screen of its own. `nativeId` rather than the
 * `localId` — the detail routes resolve their param by calling the server
 * adapter back, which only knows the origin's own id.
 */
interface ArrivedWant {
  want: Want;
  libraryCopy: { kind: 'album' | 'artist'; nativeId: string };
}

function arrivedAlbum(want: Want, albums: Album[]): Album | null {
  return matchAlbumToLibrary(
    { externalIds: normalizeExternalIds(want.externalIds), title: want.title, artistName: want.artist },
    albums
  );
}

/**
 * An artist want arrives when the artist is findable in the synced library —
 * exactly the question `matchArtistToLibrary` already answers for every other
 * surface (mbid first, then a normalized name), so it is asked here rather
 * than answered again.
 */
function arrivedArtist(want: Want, artists: Artist[]): Artist | null {
  return matchArtistToLibrary(
    { externalIds: normalizeExternalIds(want.externalIds), name: want.artist || want.title },
    artists
  );
}

function arrivedTrack(want: Want, tracks: Song[]): Song | null {
  const normTitle = normalizeName(want.title);
  const normArtist = normalizeName(want.artist);
  return (
    tracks.find(
      track => normalizeName(track.title) === normTitle && normalizeName(track.artist.name) === normArtist
    ) ?? null
  );
}

/**
 * Presence-based arrival check: a want has "arrived" once its entity is
 * actually findable in the synced library — never inferred from a downloader
 * queue disappearing. Reuses the same matchers the rest of the app already
 * trusts for "is this in my library" so an album want resolves via the
 * identical mbid-first / normalized-title+artist rule as everywhere else, an
 * artist want via the artist matcher, and a track want via the same
 * normalization.
 *
 * Pure and side-effect-free: callers (the watcher hook) own dispatching
 * `removeWant` and notifying once a want is reported as arrived here. Each
 * result carries the library record it arrived as, so the notification can
 * offer a way into it rather than only naming it.
 */
export function findArrivedWants(wants: Want[], library: ArrivalLibrary): ArrivedWant[] {
  const artists = library.artists ?? [];
  const tracks = library.tracks ?? [];
  const arrived: ArrivedWant[] = [];

  for (const want of wants) {
    if (want.unit === 'album') {
      const album = arrivedAlbum(want, library.albums);
      if (album) arrived.push({ want, libraryCopy: { kind: 'album', nativeId: album.nativeId } });
      continue;
    }
    if (want.unit === 'artist') {
      const artist = arrivedArtist(want, artists);
      if (artist) arrived.push({ want, libraryCopy: { kind: 'artist', nativeId: artist.nativeId } });
      continue;
    }
    const track = arrivedTrack(want, tracks);
    // The album, not the track: a library track has no screen to open, and
    // the record it arrived on is what the listener wants to see.
    if (track) arrived.push({ want, libraryCopy: { kind: 'album', nativeId: track.album.nativeId } });
  }

  return arrived;
}

/** Whether this want's entity is in the library right now. */
export function hasWantArrived(want: Want, library: ArrivalLibrary): boolean {
  return findArrivedWants([want], library).length > 0;
}
