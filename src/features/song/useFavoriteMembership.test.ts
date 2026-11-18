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

  it('reflects a change made elsewhere instead of writing over it', async () => {
    // The tap cannot be clobbered: it sets the tick opposite to what the
    // server last said, so the only change the server can then report moves
    // toward the tap. Here the listener ticks Favorites on and the song is
    // starred on another device — the row stays ticked, and Done owes
    // nothing, because the end state is already what they asked for.
    const { result, rerender } = await renderHook(
      ({ open }: { open: boolean }) => useFavoriteMembership(song, open),
      { initialProps: { open: true } }
    );

    await act(async () => { result.current.toggle(); });
    expect(result.current.ticked).toBe(true);

    mockStarred = [{ localId: song.localId }];
    await act(async () => { rerender({ open: true }); });

    expect(result.current.ticked).toBe(true);
    expect(result.current.pendingChange()).toBeNull();
    expect(mockStar).not.toHaveBeenCalled();
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
