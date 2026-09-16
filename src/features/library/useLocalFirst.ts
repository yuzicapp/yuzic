/**
 * The local-first rule, for components.
 *
 * Reads the already-loaded catalog — the same persisted query cache every
 * library screen reads, so this starts no fetch of its own — and memoises the
 * index on it, so a shelf of ten rows costs one index build rather than ten
 * scans of the library. The rule itself is in `localFirst.ts`, which stays
 * pure; this is only the half that knows where the library lives.
 */
import { useMemo } from 'react';

import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { useTracks } from '@/features/song/useTracks';
import {
  buildLibraryIndex,
  localAlbum,
  localArtist,
  localSong,
  preferLocalSong,
  type LibraryIndex,
} from './localFirst';

interface LocalFirst {
  /** The index itself, for a caller resolving a whole list in one pass. */
  index: LibraryIndex;
  localSong: (song: Song) => Song | null;
  localAlbum: (album: Album) => Album | null;
  localArtist: (artist: Artist) => Artist | null;
  preferLocalSong: (song: Song) => Song;
}

export function useLocalFirst(): LocalFirst {
  const { albums } = useAlbums();
  const { artists } = useArtists();
  const { tracks } = useTracks();

  const index = useMemo(
    () => buildLibraryIndex({ songs: tracks, albums, artists }),
    [tracks, albums, artists]
  );

  return useMemo(
    () => ({
      index,
      localSong: (song: Song) => localSong(index, song),
      localAlbum: (album: Album) => localAlbum(index, album),
      localArtist: (artist: Artist) => localArtist(index, artist),
      preferLocalSong: (song: Song) => preferLocalSong(index, song),
    }),
    [index]
  );
}
