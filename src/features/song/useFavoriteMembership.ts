import { useCallback, useEffect, useState } from 'react';

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
 * The tick follows the starred list while the sheet is open, and Done writes
 * only where the two disagree. That is worth being precise about, because the
 * instinct — the one `usePlaylistMembership` follows with its separate
 * `baseSelectedIds` — is to freeze the state at open so a refetch cannot
 * overwrite the listener's tap.
 *
 * Here it cannot: a tap sets the tick to the opposite of what the server last
 * said, so the only change the server can then report moves *toward* the tap,
 * never away from it. Following instead buys the case where the listener taps
 * twice and nets out — the row then shows what is true rather than what was
 * true when the sheet opened — and it costs nothing, because a tick that
 * agrees with the server owes no write either way.
 *
 * This had a frozen `base` beside the tick for exactly one commit. With the
 * tick following too, `base` was equal to the live value at every moment the
 * sheet was open, so diffing against one or the other was the same program —
 * state that could not be distinguished by any test, which is the same as
 * state that is not there.
 */
export function useFavoriteMembership(song: Song | null, isSheetOpen: boolean) {
  const { songs: starredSongs } = useStarredSongs();
  const starSong = useStarSong();
  const unstarSong = useUnstarSong();

  // By identity, not by the origin's id: the same song reached from two
  // servers is not the same track. `usePlaylistMembership` compares the same way.
  const isStarred = Boolean(song) && starredSongs.some(s => s.localId === song?.localId);

  const [ticked, setTicked] = useState(isStarred);

  useEffect(() => {
    if (!isSheetOpen) return;
    setTicked(isStarred);
  }, [isSheetOpen, isStarred]);

  const toggle = useCallback(() => setTicked(value => !value), []);

  /**
   * The star or unstar this sheet owes, or null if the tick agrees with the
   * server already. Returned rather than awaited so the caller can settle it
   * alongside its playlist mutations and count a failure the same way.
   */
  const pendingChange = useCallback((): Promise<unknown> | null => {
    if (!song || ticked === isStarred) return null;
    return ticked
      ? starSong.mutateAsync(song.nativeId)
      : unstarSong.mutateAsync(song.nativeId);
  }, [song, ticked, isStarred, starSong, unstarSong]);

  return { ticked, toggle, pendingChange };
}
