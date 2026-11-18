import { useCallback, useEffect, useRef, useState } from 'react';

import type { Song } from '@/domain/entities/Song';
import { useStarredSongs } from '@/features/library/useStarredSongs';
import { useStarSong } from '@/features/library/useStarSong';
import { useUnstarSong } from '@/features/library/useUnstarSong';

/**
 * Favorites as a target in the add-to-playlist sheet (#327).
 *
 * Favorites is not a playlist on any server here — it is the starred songs,
 * assembled by `buildFavoritesPlaylist` — so it cannot ride the sheet's
 * add/remove mutations, which call playlist endpoints. It gets this instead:
 * the same tick-then-Done shape, carried out with star/unstar.
 *
 * **Why it belongs in that sheet at all.** It was deliberately excluded, on
 * the grounds that the heart on the song already does this. On the fullscreen
 * player there is no heart — the only route is the three-dot menu — so the `+`
 * is the most favourite-shaped control on that screen, and it was the one
 * place Favorites could not be reached. For a listener with no playlists of
 * their own, excluding it also left the sheet rendering nothing at all, which
 * is what #327 reports. Two controls over one piece of state do not confuse
 * anyone while they agree, and both of these read the same starred songs.
 *
 * The tick and the state it is compared against are both taken when the sheet
 * opens, and neither is resynced while it is open — the same base/selected
 * split `usePlaylistMembership` keeps, for the same two reasons. The starred
 * list is a query: a refetch mid-sheet would otherwise overwrite what the
 * listener just ticked, and comparing against a *live* value at Done would
 * let a change made elsewhere turn an untouched row into a write. The sheet
 * writes what the listener changed in it, and nothing else.
 */
export function useFavoriteMembership(song: Song | null, isSheetOpen: boolean) {
  const { songs: starredSongs } = useStarredSongs();
  const starSong = useStarSong();
  const unstarSong = useUnstarSong();

  // By identity, not by the origin's id: the same song reached from two
  // servers is not the same track. `usePlaylistMembership` compares the same way.
  const isStarred = Boolean(song) && starredSongs.some(s => s.localId === song?.localId);

  const [ticked, setTicked] = useState(isStarred);
  /** What the server held when the sheet opened — what Done diffs against. */
  const [base, setBase] = useState(isStarred);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isSheetOpen && !wasOpen.current) {
      setTicked(isStarred);
      setBase(isStarred);
    }
    wasOpen.current = isSheetOpen;
  }, [isSheetOpen, isStarred]);

  const toggle = useCallback(() => setTicked(value => !value), []);

  /**
   * The star or unstar this sheet owes, or null if the tick ends where it
   * started. Returned rather than awaited so the caller can settle it
   * alongside its playlist mutations and count a failure the same way.
   */
  const pendingChange = useCallback((): Promise<unknown> | null => {
    if (!song || ticked === base) return null;
    return ticked
      ? starSong.mutateAsync(song.nativeId)
      : unstarSong.mutateAsync(song.nativeId);
  }, [song, ticked, base, starSong, unstarSong]);

  return { ticked, toggle, pendingChange };
}
