import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useApi } from '@/providers/registry/useApi';
import { playableResourceKey } from '@/features/song/playableResourcePersistence';
import { useDownloadActions } from '@/features/offline/DownloadContext';
import { useSongsById } from '@/features/song/useSongsById';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { playableCodec } from '@/features/playback/playableFormat';
import { selectPreferredCodec } from '@/features/settings/playback/state';
import type { Song } from '@/domain/entities/Song';
import { isPlayable, type PlayableResource } from '@/features/playback/playableResource';
import { useStreamQuality } from '@/features/playback/useStreamQuality';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Anything that names a song: the origin's own id, or a song that already
 * carries it. Only the id is taken from an object input — the resource is
 * always built from the library's own record or a fresh fetch, never from
 * whatever fields the caller happened to be holding.
 */
type PlayableSongInput = string | Song | null | undefined;

type ResolvePlayableSongOptions = {
  allowNetwork?: boolean;
  timeoutMs?: number;
};

function songIdFromInput(input: PlayableSongInput): string | null {
  if (!input) return null;
  return typeof input === 'string' ? input : input.nativeId;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Resolves anything identifying a song (an id, or a legacy-shaped object
 * carrying one) into a `PlayableResource` — the domain `Song` plus a stream
 * URL valid for this session, built at the moment of playing rather than
 * trusted from whatever the caller already had on hand.
 */
export function usePlayableSongResolver() {
  const api = useApi();
  const queryClient = useQueryClient();
  const activeServer = useSelector(selectActiveServer);
  // Keyed by nativeId — see useSongsById.
  const songsById = useSongsById();
  const { getLocalPath } = useDownloadActions();
  const streamQuality = useStreamQuality();
  const preferredCodec = useSelector(selectPreferredCodec);

  const resolvePlayableSong = useCallback(async (
    input: PlayableSongInput,
    options: ResolvePlayableSongOptions = {}
  ): Promise<PlayableResource | null> => {
    const songId = songIdFromInput(input);
    if (!songId) return null;

    // A downloaded file is playable from its own bytes regardless of server
    // reachability, so it takes priority over the cache below. Downloads are
    // filed under the song's `localId`, which only the synced library's copy
    // can supply from the server id this was asked with — and a download
    // always starts from a synced row.
    const librarySong = songsById.get(songId);
    const localPath = librarySong ? getLocalPath(librarySong.localId) : null;
    if (librarySong && localPath) {
      const resource: PlayableResource = { song: librarySong, streamUrl: localPath, filePath: localPath };
      queryClient.setQueryData(playableResourceKey(activeServer?.id, songId), resource);
      return resource;
    }

    const cachedResource = queryClient.getQueryData<PlayableResource | null>(
      playableResourceKey(activeServer?.id, songId)
    );
    if (cachedResource && isPlayable(cachedResource)) return cachedResource;

    if (options.allowNetwork === false) return null;

    // Prefer the synced library's own copy — no network round trip — and
    // fall back to fetching it fresh (a track outside the synced library:
    // search, an artist page never opened before, ...).
    const domainSong = librarySong ?? await withTimeout(
      api.tracks.get(songId),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    ).catch(() => null);
    if (!domainSong) return null;

    const streamUrl = api.songs.buildStreamUrl(
      domainSong.streamId ?? domainSong.nativeId,
      streamQuality,
      playableCodec(preferredCodec)
    );
    if (!streamUrl) return null;

    const resource: PlayableResource = { song: domainSong, streamUrl };
    queryClient.setQueryData(playableResourceKey(activeServer?.id, songId), resource);
    return resource;
  }, [activeServer?.id, api.songs, api.tracks, getLocalPath, preferredCodec, queryClient, songsById, streamQuality]);

  return { resolvePlayableSong };
}
