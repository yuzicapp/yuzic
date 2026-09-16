import { readFileSync } from 'fs';
import { join } from 'path';
import reducer, {
  addWant,
  removeWant,
  setWantJobRef,
  clearWantsForServer,
  type Want,
} from './wantsSlice';
import type { LocalId } from '@/domain/identity/LocalId';

const wantInput = (localId: string, overrides: Partial<Omit<Want, 'createdAt' | 'updatedAt'>> = {}) => ({
  localId: localId as LocalId,
  unit: 'track' as const,
  title: 'Idioteque',
  artist: 'Radiohead',
  origin: 'search' as const,
  ...overrides,
});

describe('wantsSlice', () => {
  it('adds a want for a server', () => {
    const state = reducer(undefined, addWant({ serverId: 's1', want: wantInput('w1') }));

    expect(state.byServer.s1).toHaveLength(1);
    expect(state.byServer.s1[0]).toMatchObject({
      localId: 'w1',
      title: 'Idioteque',
      artist: 'Radiohead',
      unit: 'track',
      origin: 'search',
    });
    expect(state.byServer.s1[0].createdAt).toBeGreaterThan(0);
    expect(state.byServer.s1[0].updatedAt).toBe(state.byServer.s1[0].createdAt);
  });

  it('upserts instead of duplicating when the same localId is added twice on the same server', () => {
    let state = reducer(undefined, addWant({ serverId: 's1', want: wantInput('w1') }));
    const firstCreatedAt = state.byServer.s1[0].createdAt;

    state = reducer(
      state,
      addWant({ serverId: 's1', want: wantInput('w1', { title: 'Idioteque (Live)' }) })
    );

    expect(state.byServer.s1).toHaveLength(1);
    expect(state.byServer.s1[0].title).toBe('Idioteque (Live)');
    // createdAt is preserved from the original insert; updatedAt reflects the upsert.
    expect(state.byServer.s1[0].createdAt).toBe(firstCreatedAt);
    expect(state.byServer.s1[0].updatedAt).toBeGreaterThanOrEqual(firstCreatedAt);
  });

  it('removes a want by localId', () => {
    let state = reducer(undefined, addWant({ serverId: 's1', want: wantInput('w1') }));
    state = reducer(state, addWant({ serverId: 's1', want: wantInput('w2') }));

    state = reducer(state, removeWant({ serverId: 's1', localId: 'w1' as LocalId }));

    expect(state.byServer.s1).toHaveLength(1);
    expect(state.byServer.s1[0].localId).toBe('w2');
  });

  it('removing a want that does not exist is a no-op', () => {
    const state = reducer(undefined, removeWant({ serverId: 's1', localId: 'nope' as LocalId }));
    expect(state.byServer.s1).toBeUndefined();
  });

  it('sets a jobRef on a want without changing anything else', () => {
    let state = reducer(undefined, addWant({ serverId: 's1', want: wantInput('w1') }));
    const before = state.byServer.s1[0];

    state = reducer(state, setWantJobRef({
      serverId: 's1', localId: 'w1' as LocalId, jobRef: { downloader: 'lidarr', requestedAt: 1_000 },
    }));

    const after = state.byServer.s1[0];
    // Which downloader was asked, and when — the two facts a row needs to
    // find the job in that downloader's queue and to tell "not picked up
    // yet" from "never arrived". Deliberately not a status.
    expect(after.jobRef).toEqual({ downloader: 'lidarr', requestedAt: 1_000 });
    expect(after.title).toBe(before.title);
    expect(after.artist).toBe(before.artist);
    expect(after.unit).toBe(before.unit);
    expect(after.origin).toBe(before.origin);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('setting a jobRef for a missing want is a no-op', () => {
    const state = reducer(undefined, setWantJobRef({
      serverId: 's1', localId: 'nope' as LocalId, jobRef: { downloader: 'slskd', requestedAt: 1 },
    }));
    expect(state.byServer.s1).toBeUndefined();
  });

  it('clears a jobRef, so a retry is not read as the first job still running', () => {
    let state = reducer(undefined, addWant({ serverId: 's1', want: wantInput('w1') }));
    state = reducer(state, setWantJobRef({
      serverId: 's1', localId: 'w1' as LocalId, jobRef: { downloader: 'lidarr', requestedAt: 1 },
    }));

    state = reducer(state, setWantJobRef({ serverId: 's1', localId: 'w1' as LocalId, jobRef: undefined }));

    expect(state.byServer.s1[0].jobRef).toBeUndefined();
  });

  it('saves the cover the record was found with, so the row can draw it', () => {
    const cover = { kind: 'none' as const, subject: { kind: 'album' as const, title: 'Kid A', artistName: 'Radiohead' } };
    const state = reducer(undefined, addWant({
      serverId: 's1', want: wantInput('w1', { cover }),
    }));

    expect(state.byServer.s1[0].cover).toEqual(cover);
  });

  it('holds an artist want alongside the release units', () => {
    const state = reducer(undefined, addWant({
      serverId: 's1',
      want: wantInput('w1', { unit: 'artist', title: 'Radiohead', artist: 'Radiohead' }),
    }));

    expect(state.byServer.s1[0].unit).toBe('artist');
  });

  it('keeps wants isolated per server', () => {
    let state = reducer(undefined, addWant({ serverId: 'a', want: wantInput('w1') }));
    state = reducer(state, addWant({ serverId: 'b', want: wantInput('w2') }));

    expect(state.byServer.a).toHaveLength(1);
    expect(state.byServer.a[0].localId).toBe('w1');
    expect(state.byServer.b).toHaveLength(1);
    expect(state.byServer.b[0].localId).toBe('w2');
  });

  it('clears all wants for a server without touching others', () => {
    let state = reducer(undefined, addWant({ serverId: 'a', want: wantInput('w1') }));
    state = reducer(state, addWant({ serverId: 'b', want: wantInput('w2') }));

    state = reducer(state, clearWantsForServer({ serverId: 'a' }));

    expect(state.byServer.a).toEqual([]);
    expect(state.byServer.b).toHaveLength(1);
  });

  it('is pure: does not import anything network-related', () => {
    // Static guard against accidental network/provider imports creeping into
    // this save-only slice. If this ever needs an import, it no longer
    // qualifies as save-only and the design has changed.
    const path = join(__dirname, 'wantsSlice.ts');
    const source = readFileSync(path, 'utf8');
    expect(source).not.toMatch(/fetch\(|axios|XMLHttpRequest|\/api\//);
  });
});
