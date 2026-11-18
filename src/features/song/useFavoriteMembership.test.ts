import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react-native';

import type { Song } from '@/domain/entities/Song';
import { useFavoriteMembership } from './useFavoriteMembership';

/**
 * Favorites in the add-to-playlist sheet (#327). It cannot use the sheet's
 * add/remove mutations — it is the starred songs, not a playlist — so what is
 * asserted here is that it keeps the sheet's tick-then-Done shape while
 * committing with star/unstar, and that nothing is written when the tick ends
 * where it began.
 */
jest.mock('@/features/library/useStarredSongs', () => ({
  useStarredSongs: () => ({ songs: mockStarred }),
}));
jest.mock('@/features/library/useStarSong', () => ({
  useStarSong: () => ({ mutateAsync: mockStar }),
}));
jest.mock('@/features/library/useUnstarSong', () => ({
  useUnstarSong: () => ({ mutateAsync: mockUnstar }),
}));

/* eslint-disable no-var -- hoisted for the jest.mock factories above */
var mockStarred: { localId: string }[] = [];
var mockStar = jest.fn().mockResolvedValue(undefined);
var mockUnstar = jest.fn().mockResolvedValue(undefined);
/* eslint-enable no-var */

const song = { localId: 'local:song:srv:srv-1:tr-1', nativeId: 'tr-1' } as Song;

describe('useFavoriteMembership', () => {
  beforeEach(() => {
    mockStarred = [];
    mockStar = jest.fn().mockResolvedValue(undefined);
    mockUnstar = jest.fn().mockResolvedValue(undefined);
  });

  it('starts ticked for a song that is already starred', async () => {
    mockStarred = [{ localId: song.localId }];

    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    expect(result.current.ticked).toBe(true);
  });

  it('starts unticked for a song that is not', async () => {
    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    expect(result.current.ticked).toBe(false);
  });

  it('matches by identity, so the same id from another server does not count', async () => {
    mockStarred = [{ localId: 'local:song:srv:srv-2:tr-1' }];

    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    expect(result.current.ticked).toBe(false);
  });

  it('stars the song when ticked on', async () => {
    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    await act(async () => { result.current.toggle(); });
    await result.current.pendingChange();

    expect(mockStar).toHaveBeenCalledWith('tr-1');
    expect(mockUnstar).not.toHaveBeenCalled();
  });

  it('unstars the song when ticked off', async () => {
    mockStarred = [{ localId: song.localId }];
    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    await act(async () => { result.current.toggle(); });
    await result.current.pendingChange();

    expect(mockUnstar).toHaveBeenCalledWith('tr-1');
    expect(mockStar).not.toHaveBeenCalled();
  });

  it('writes nothing when the tick ends where it started', async () => {
    const { result } = await renderHook(() => useFavoriteMembership(song, true));

    // On, then off again: Done owes the server nothing.
    await act(async () => { result.current.toggle(); });
    await act(async () => { result.current.toggle(); });

    expect(result.current.pendingChange()).toBeNull();
    expect(mockStar).not.toHaveBeenCalled();
    expect(mockUnstar).not.toHaveBeenCalled();
  });

  it('writes nothing with no song to write about', async () => {
    const { result } = await renderHook(() => useFavoriteMembership(null, true));

    expect(result.current.pendingChange()).toBeNull();
  });

  it('keeps the tick when the song is starred elsewhere mid-sheet', async () => {
    // The regression this guards: resyncing while the sheet is open would
    // overwrite what the listener just ticked, so the open transition is the
    // only moment the tick is taken. Starting from ticked-on and having the
    // server disagree is the only arrangement where the two differ.
    const { result, rerender } = await renderHook(
      ({ open }: { open: boolean }) => useFavoriteMembership(song, open),
      { initialProps: { open: true } }
    );

    await act(async () => { result.current.toggle(); });
    expect(result.current.ticked).toBe(true);

    // Another device unstars it — or a refetch corrects an earlier answer.
    mockStarred = [];
    await act(async () => { rerender({ open: true }); });

    expect(result.current.ticked).toBe(true);
  });

  it('writes nothing for a row the listener never touched, however the server changes', async () => {
    // Done diffs against what the server held when the sheet opened, not
    // against a live value: comparing live, an untouched row whose state
    // changed elsewhere would be written back — unstarring a song nobody
    // asked to unstar.
    mockStarred = [];
    const { result, rerender } = await renderHook(
      ({ open }: { open: boolean }) => useFavoriteMembership(song, open),
      { initialProps: { open: true } }
    );

    expect(result.current.ticked).toBe(false);

    mockStarred = [{ localId: song.localId }];
    await act(async () => { rerender({ open: true }); });

    expect(result.current.pendingChange()).toBeNull();
    expect(mockUnstar).not.toHaveBeenCalled();
    expect(mockStar).not.toHaveBeenCalled();
  });

  it('takes the tick again each time the sheet reopens', async () => {
    mockStarred = [{ localId: song.localId }];
    const { result, rerender } = await renderHook(
      ({ open }: { open: boolean }) => useFavoriteMembership(song, open),
      { initialProps: { open: true } }
    );

    await act(async () => { result.current.toggle(); });
    expect(result.current.ticked).toBe(false);

    await act(async () => { rerender({ open: false }); });
    await act(async () => { rerender({ open: true }); });

    expect(result.current.ticked).toBe(true);
  });
});

/**
 * The hook is inert unless the sheet renders the row and commits its change,
 * and neither is visible from this module. No test renders `PlaylistList` —
 * it needs the bottom-sheet stack, the query client and the store — so this
 * reads its source, as `externalResolutionMount.test` and
 * `LyricsPreviewCard.test` do for the same reason. It is a wiring guard, not
 * a render test: it says the row is pinned and committed, not that it looks
 * right.
 */
describe('the add-to-playlist sheet wires it in', () => {
  const sheet = readFileSync(
    join(__dirname, '..', '..', 'components', 'PlaylistList.tsx'),
    'utf8'
  );

  it('pins the row above the playlists rather than mixing it in', () => {
    // As the list header, so it cannot be reordered among real playlists or
    // sorted away by a rename.
    expect(sheet).toMatch(/ListHeaderComponent=\{renderFavoritesRow\}/);
  });

  it('commits the change with the playlist mutations, so a failure counts', () => {
    expect(sheet).toMatch(/favorite\.pendingChange\(\)/);
    expect(sheet).toMatch(/mutations\.push\(favoriteChange\)/);
  });

  it('still keeps the server-side Favorites playlist out of the list itself', () => {
    // Otherwise the pinned row and a real Favorites row would both be there,
    // doing different things to the same state.
    expect(sheet).toMatch(/p\.nativeId !== FAVORITES_ID/);
  });
});
