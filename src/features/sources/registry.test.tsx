import React, { type ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { ALL_SOURCES, getSourceMeta, useEnabledExternalSources } from './registry';
import settingsSourcesReducer, { setSourceUse } from '@/features/settings/sources/state';

function makeStore(overrides: Partial<{ deezer: boolean; musicbrainz: boolean }> = {}) {
  const store = configureStore({ reducer: { settingsSources: settingsSourcesReducer } });
  if (overrides.deezer !== undefined) store.dispatch(setSourceUse({ use: 'deezer.search', enabled: overrides.deezer }));
  if (overrides.musicbrainz !== undefined) store.dispatch(setSourceUse({ use: 'musicbrainz.search', enabled: overrides.musicbrainz }));
  return store;
}

function wrapper(store: ReturnType<typeof makeStore>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestStoreWrapper';
  return Wrapper;
}

describe('getSourceMeta', () => {
  it('returns label/color for a known source and null otherwise', () => {
    expect(getSourceMeta('deezer')).toEqual(expect.objectContaining({ label: 'Deezer', color: expect.any(String) }));
    expect(getSourceMeta('musicbrainz')).toEqual(expect.objectContaining({ label: 'MusicBrainz', color: '#BA478F' }));
    expect(getSourceMeta('nonexistent')).toBeNull();
  });
});

describe('useEnabledExternalSources', () => {
  it('is empty when both sources are disabled (the default)', async () => {
    const store = makeStore();
    const { result } = await renderHook(() => useEnabledExternalSources(), { wrapper: wrapper(store) });
    expect(result.current).toEqual([]);
  });

  it('includes only the sources switched on — the same switch Search uses', async () => {
    const store = makeStore({ deezer: true, musicbrainz: false });
    const { result } = await renderHook(() => useEnabledExternalSources(), { wrapper: wrapper(store) });
    expect(result.current.map((s) => s.id)).toEqual(['deezer']);
  });

  it('includes both sources when both are switched on', async () => {
    const store = makeStore({ deezer: true, musicbrainz: true });
    const { result } = await renderHook(() => useEnabledExternalSources(), { wrapper: wrapper(store) });
    expect(result.current.map((s) => s.id).sort()).toEqual(['deezer', 'musicbrainz']);
  });
});

/**
 * Both sources are keyless public APIs — no credentials, no server URL, no
 * account — so they declare a
 * `'none'` auth tier and a trivial `testConnection` (nothing to authenticate;
 * "enabled" is a plain user setting, not a connection). Each declares both
 * `resolution` (its resolveArtist/resolveAlbum/fetchAlbum identity/metadata
 * work) and `discovery.shelf` (it feeds Home's external discovery shelves).
 */
describe('sources as providers', () => {

  it('declares none auth for every source', () => {
    for (const def of ALL_SOURCES) {
      expect(def.auth.tier).toBe('none');
      expect(def.auth.configKeys).toBeUndefined();
    }
  });

  it('resolves testConnection to {ok: true} without any network call', async () => {
    for (const def of ALL_SOURCES) {
      await expect(def.testConnection({})).resolves.toEqual({ ok: true });
    }
  });


  it('keeps the resolve/fetch methods callable independent of slots', () => {
    for (const def of ALL_SOURCES) {
      expect(typeof def.resolveArtist).toBe('function');
      expect(typeof def.resolveAlbum).toBe('function');
      expect(typeof def.fetchAlbum).toBe('function');
      expect(typeof def.fetchArtist).toBe('function');
      expect(typeof def.fetchArtistAlbums).toBe('function');
    }
  });
});

describe('MusicBrainz candidates and artist pages', () => {
  const client = {
    searchArtist: jest.fn(),
    searchReleaseGroup: jest.fn(),
    getArtistWithReleases: jest.fn(),
  };
  const musicbrainz = ALL_SOURCES.find(s => s.id === 'musicbrainz')!;

  beforeEach(() => {
    jest.spyOn(require('@/providers/registry/musicbrainz'), 'currentMusicbrainzClient')
      .mockReturnValue(client);
  });
  afterEach(() => jest.restoreAllMocks());

  it('offers every match with what tells namesakes apart', async () => {
    client.searchArtist.mockResolvedValue([
      { id: 'mb-1', name: 'Nirvana', disambiguation: 'US grunge band' },
      { id: 'mb-2', name: 'Nirvana', disambiguation: 'UK 60s band' },
    ]);

    const candidates = await musicbrainz.resolveArtistCandidates('Nirvana', 5);

    expect(client.searchArtist).toHaveBeenCalledWith('Nirvana', 5);
    expect(candidates.map(c => [c.id, c.detail])).toEqual([
      ['mb-1', 'US grunge band'],
      ['mb-2', 'UK 60s band'],
    ]);
  });

  it('names each album candidate by its own credit, not by the name asked about', async () => {
    client.searchReleaseGroup.mockResolvedValue([
      { id: 'rg-1', title: 'Bleach', 'first-release-date': '1989-06-15', 'artist-credit': [{ artist: { id: 'mb-1', name: 'Nirvana' } }] },
      { id: 'rg-2', title: 'Bleach', 'artist-credit': [{ artist: { id: 'mb-9', name: 'Tribute Band' } }] },
    ]);

    const candidates = await musicbrainz.resolveAlbumCandidates('Nirvana', 'Bleach', 5);

    expect(candidates.map(c => [c.artist, c.year])).toEqual([['Nirvana', 1989], ['Tribute Band', undefined]]);
  });

  it('credits an artist page\'s albums to that artist', async () => {
    // The lookup's release groups carry no credit, so these were all by
    // "Unknown Artist" and opening one searched under that name.
    client.getArtistWithReleases.mockResolvedValue({
      id: 'mb-1',
      name: 'Nirvana',
      'release-groups': [{ id: 'rg-1', title: 'Bleach', 'primary-type': 'Album' }],
    });

    const detail = await musicbrainz.fetchArtist('mb-1');

    expect(detail?.albums[0].artist).toMatchObject({ nativeId: 'mb-1', name: 'Nirvana' });
  });
});
