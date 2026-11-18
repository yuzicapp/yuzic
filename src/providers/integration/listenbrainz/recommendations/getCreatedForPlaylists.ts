import { fetchWithTimeout } from '@/providers/http/fetchWithTimeout';
import type { Song } from '@/domain/entities/Song';
import { albumCoverSubject, artistCoverSubject, missingCover, type CoverSource } from '@/domain/entities/Cover';
import { makeLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance } from '@/domain/identity/Provenance';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

const BASE_URL = 'https://api.listenbrainz.org/1';
const PROVENANCE = integrationProvenance('musicbrainz');

/** The three periodic mixes troi-bot generates for a user. Anything else
 * ListenBrainz might create-for (a one-off, a different bot) is ignored —
 * this shelf mirrors the LOCKED set, not "whatever comes back". */
const CREATED_FOR_MIX_TYPES = ['daily-jams', 'weekly-jams', 'weekly-exploration'] as const;

export type CreatedForMixType = (typeof CREATED_FOR_MIX_TYPES)[number];

type LBCreatedForMix = {
  mixType: CreatedForMixType;
  title: string;
  playlistMbid: string;
  tracks: Song[];
};

type JspfTrack = {
  title?: string;
  creator?: string;
  album?: string;
  identifier?: string | string[];
  duration?: number;
  extension?: {
    'https://musicbrainz.org/doc/jspf#track'?: {
      additional_metadata?: {
        /** The credited artists, lead first; `creator` is them joined into one line. */
        artists?: { artist_mbid?: string }[];
        /** The release ListenBrainz found front art for on Cover Art Archive. */
        caa_release_mbid?: string;
      };
    };
  };
};

type JspfPlaylist = {
  title?: string;
  track?: JspfTrack[];
  identifier?: string;
  extension?: {
    'https://musicbrainz.org/doc/jspf#playlist'?: {
      additional_metadata?: {
        algorithm_metadata?: {
          source_patch?: string;
        };
      };
    };
  };
};

type CreatedForResponse = {
  playlists?: { playlist: JspfPlaylist }[];
};

type PlaylistResponse = {
  playlist?: JspfPlaylist;
};

function extractMbidFromIdentifier(identifier?: string | string[]): string | null {
  const first = Array.isArray(identifier) ? identifier[0] : identifier;
  if (!first) return null;
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i.exec(first);
  return match ? match[1] : null;
}

function playlistMbidFromIdentifier(identifier?: string): string | null {
  if (!identifier) return null;
  const parts = identifier.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function mapTrack(track: JspfTrack): Song | null {
  if (!track.title || !track.creator) return null;
  const mbid = extractMbidFromIdentifier(track.identifier);
  // Falls back to a synthetic "creator:title" id when the JSPF entry carries
  // no MusicBrainz recording identifier — same fallback the pre-rewrite
  // shape used, so a track missing an mbid still gets a stable, distinct id
  // rather than colliding with every other id-less track.
  const nativeId = mbid ?? `${track.creator}:${track.title}`;
  const metadata = track.extension?.['https://musicbrainz.org/doc/jspf#track']?.additional_metadata;
  const releaseMbid = metadata?.caa_release_mbid;
  const leadMbid = metadata?.artists?.[0]?.artist_mbid;
  const albumIds = releaseMbid ? { mbid: releaseMbid, mbidType: 'release' as const } : {};
  // ListenBrainz names the release it has Cover Art Archive art for, so that
  // is this track's own picture; a track without one is a gap for the backups.
  const albumCover: CoverSource = releaseMbid
    ? { kind: 'coverartarchive', mbid: releaseMbid, mbidType: 'release' }
    : missingCover(albumCoverSubject(track.album, track.creator, albumIds));
  return {
    localId: makeLocalId('song', PROVENANCE, nativeId),
    nativeId,
    provenance: PROVENANCE,
    externalIds: mbid ? { mbid } : {},
    title: track.title,
    artist: {
      localId: makeLocalId('artist', PROVENANCE, track.creator),
      // No artist id in a JSPF track entry — only its display name.
      nativeId: '',
      externalIds: {},
      name: track.creator,
      cover: missingCover(artistCoverSubject(track.creator, leadMbid ? { mbid: leadMbid } : {})),
    },
    album: {
      localId: makeLocalId('album', PROVENANCE, track.album ?? ''),
      // Same — JSPF names the album, not its id.
      nativeId: '',
      externalIds: albumIds,
      title: track.album ?? '',
      cover: albumCover,
    },
    cover: albumCover,
    durationSeconds: track.duration ? Math.round(track.duration / 1000) : 0,
    contentKind: 'song',
    genres: [],
  };
}

/**
 * Fetches one createdfor playlist's full track listing.
 *
 * Public — createdfor playlists are always public — so no token is needed,
 * though sending one is harmless.
 */
async function fetchPlaylistTracks(playlistMbid: string): Promise<Song[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/playlist/${playlistMbid}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PlaylistResponse;
  const tracks = data.playlist?.track ?? [];
  const mapped: Song[] = [];
  for (const track of tracks) {
    const song = mapTrack(track);
    if (song) mapped.push(song);
  }
  return mapped;
}

/**
 * ListenBrainz's periodic "created for you" mixes — Daily Jams, Weekly Jams,
 * Weekly Exploration — built by troi-bot, not by anything in this app. This
 * fetches the metadata list, keeps only the three known mix types (matched by
 * `source_patch` in the JSPF algorithm metadata, falling back to the title
 * when that's missing), and fills each one in with its tracks.
 *
 * Public — no auth required — but needs a username to fetch for. Returns []
 * rather than throwing on any failure, missing username, or empty response:
 * this is a Home shelf, not a critical path, and an empty array is what
 * makes the shelf hide itself.
 */
export async function getCreatedForPlaylists(username?: string | null): Promise<LBCreatedForMix[]> {
  if (!username) return [];

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/user/${encodeURIComponent(username)}/playlists/createdfor`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as CreatedForResponse;
    const stubs = data.playlists ?? [];

    const matched: { mixType: CreatedForMixType; title: string; playlistMbid: string }[] = [];
    for (const { playlist } of stubs) {
      const sourcePatch =
        playlist.extension?.['https://musicbrainz.org/doc/jspf#playlist']?.additional_metadata
          ?.algorithm_metadata?.source_patch;
      const mixType = (CREATED_FOR_MIX_TYPES as readonly string[]).includes(sourcePatch ?? '')
        ? (sourcePatch as CreatedForMixType)
        : null;
      if (!mixType) continue;

      const playlistMbid = playlistMbidFromIdentifier(playlist.identifier);
      if (!playlistMbid) continue;

      matched.push({ mixType, title: playlist.title ?? mixType, playlistMbid });
    }

    const results = await Promise.allSettled(
      matched.map(async (m) => ({
        ...m,
        tracks: await fetchPlaylistTracks(m.playlistMbid),
      }))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<LBCreatedForMix> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((mix) => mix.tracks.length > 0);
  } catch (error) {
    log.integration.error('request failed', { provider: 'listenbrainz', operation: 'getCreatedForPlaylists', detail: detailOf(error) });
    return [];
  }
}
