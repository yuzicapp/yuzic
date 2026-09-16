import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import LBSimilarForYouSection, { NEXT_SEED_DELAY_MS } from './LBSimilarForYouSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => (options?.artist ? `${key}:${options.artist}` : key),
  }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666' } }),
}));

jest.mock('@/features/sources/useMatchedNavigation', () => ({
  useMatchedNavigation: () => ({ navigateToArtist: jest.fn() }),
}));

jest.mock('@/features/artist/useArtists', () => ({
  useArtists: () => ({ artists: [] }),
}));

jest.mock('./SourceGroup', () => ({
  useSourceSectionPresence: jest.fn(),
}));

jest.mock('@/components/SkeletonTiles', () => 'SkeletonTiles');

// The tile now carries its own options sheet (`OptionsTile`), which pulls in
// the bottom-sheet library; this shelf's test is about which artists it shows.
jest.mock('./OptionsTile', () => {
  const { Text } = require('react-native');
  return function MockOptionsTile({ title }: { title: string }) {
    return <Text>{title}</Text>;
  };
});

jest.mock('@shopify/flash-list', () => {
  const { View } = require('react-native');
  return {
    FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: (info: { item: unknown }) => React.ReactNode }) => (
      <View>{data.map((item, i) => <View key={i}>{renderItem({ item })}</View>)}</View>
    ),
  };
});

jest.mock('@/providers/registry/homeDiscovery', () => ({
  LISTENERS_HOME_USE: 'listenbrainz.homeShelves',
  fetchSimilarArtistsFromListeners: jest.fn(),
}));

// Seed name → MBID the lookup resolves to (null: MusicBrainz matched nothing).
const mockMbids: Record<string, string | null> = {};
const mockLookups: string[] = [];
jest.mock('@/features/artist/useArtistMbid', () => ({
  useArtistMbid: (name: string, _local: unknown, options: { enabled?: boolean }) => {
    if (!options.enabled || !name) return { mbid: null, isResolving: false };
    if (!mockLookups.includes(name)) mockLookups.push(name);
    return { mbid: mockMbids[name] ?? null, isResolving: false };
  },
}));

// MBID → similar artists ListenBrainz answers with. Mocked at `useQuery` so the
// test stays synchronous, as the other ListenBrainz shelf's test does.
const mockSimilar: Record<string, string[]> = {};
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[]; enabled: boolean }) => {
    const mbid = options.queryKey[1] as string;
    if (!options.enabled) return { data: undefined, isLoading: false, isSuccess: false, isFetching: false };
    const names = mockSimilar[mbid] ?? [];
    return {
      data: names.map(name => ({ localId: `local:artist:${name}`, name, cover: { kind: 'none' } })),
      isLoading: false,
      isSuccess: true,
      isFetching: false,
    };
  },
}));

function renderShelf(artistNames: string[], { discoveryEnabled = true } = {}) {
  const store = configureStore({
    reducer: {
      settingsSources: (state = { uses: { 'listenbrainz.homeShelves': discoveryEnabled } }) => state,
    },
  });
  return render(
    <Provider store={store}>
      <LBSimilarForYouSection sectionKey="lbSimilarArtistsForYou" artistNames={artistNames} />
    </Provider>
  );
}

const TITLE = 'explore.sections.lbSimilarForYou';

describe('LBSimilarForYouSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    for (const record of [mockMbids, mockSimilar]) {
      for (const key of Object.keys(record)) delete record[key];
    }
    mockLookups.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the first seed that has listeners, and never asks about the rest', async () => {
    mockMbids.Radiohead = 'mbid-radiohead';
    mockSimilar['mbid-radiohead'] = ['Muse'];

    const view = await renderShelf(['Radiohead', 'Bowie']);
    await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS * 3); });

    expect(view.getByText(`${TITLE}:Radiohead`)).toBeTruthy();
    expect(view.getByText('Muse')).toBeTruthy();
    expect(mockLookups).toEqual(['Radiohead']);
  });

  it('moves on to the next seed when ListenBrainz has nobody for the first', async () => {
    mockMbids['Carter Vail'] = 'mbid-carter';
    mockMbids.Bowie = 'mbid-bowie';
    mockSimilar['mbid-bowie'] = ['Iggy Pop'];

    const view = await renderShelf(['Carter Vail', 'Bowie']);
    await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS); });

    expect(view.getByText(`${TITLE}:Bowie`)).toBeTruthy();
    expect(view.getByText('Iggy Pop')).toBeTruthy();
  });

  it('moves on when MusicBrainz matches no artist for a seed', async () => {
    mockMbids.Bowie = 'mbid-bowie';
    mockSimilar['mbid-bowie'] = ['Iggy Pop'];

    const view = await renderShelf(['Binaerpilot', 'Bowie']);
    await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS); });

    expect(view.getByText('Iggy Pop')).toBeTruthy();
  });

  it('waits between seeds, so MusicBrainz is asked at most once a second', async () => {
    mockMbids.Bowie = 'mbid-bowie';
    mockSimilar['mbid-bowie'] = ['Iggy Pop'];

    const view = await renderShelf(['Carter Vail', 'Bowie']);
    await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS - 100); });

    expect(mockLookups).toEqual(['Carter Vail']);
    expect(view.queryByText('Iggy Pop')).toBeNull();
    // Still trying, so the shelf holds its place with a skeleton.
    expect(view.getByText(`${TITLE}:Carter Vail`)).toBeTruthy();
  });

  it('hides once no seed has listeners', async () => {
    mockMbids['Carter Vail'] = 'mbid-carter';
    mockMbids['Chillhop Music'] = 'mbid-chillhop';

    const view = await renderShelf(['Carter Vail', 'Binaerpilot', 'Chillhop Music']);
    // One step per act: the next seed's timer is only set once the shelf has
    // re-rendered on the one before it.
    for (let step = 0; step < 3; step++) {
      await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS); });
    }

    expect(view.toJSON()).toBeNull();
    expect(mockLookups).toEqual(['Carter Vail', 'Binaerpilot', 'Chillhop Music']);
  });

  it('asks about nothing with ListenBrainz discovery off', async () => {
    mockMbids.Radiohead = 'mbid-radiohead';
    mockSimilar['mbid-radiohead'] = ['Muse'];

    const view = await renderShelf(['Radiohead', 'Bowie'], { discoveryEnabled: false });
    await act(async () => { jest.advanceTimersByTime(NEXT_SEED_DELAY_MS * 3); });

    expect(view.toJSON()).toBeNull();
    expect(mockLookups).toEqual([]);
  });
});
