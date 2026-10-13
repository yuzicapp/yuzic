import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DownloadersQueueProvider, useDownloadersQueue } from './DownloadersQueueContext';
import type { DownloaderQueueItem } from './queueItem';
import type { DownloaderState } from './registry';

/* eslint-disable no-var -- hoisted for the jest.mock factories below */
// Every one of these is a fixed reference on purpose. The provider uses
// `connectedStates`, `api.auth` and `sync` as effect dependencies, so a mock
// that built a fresh object per render would poll, set state, re-render and
// poll again — the render loop `registry.test.tsx` already pins down.
var mockApi = { auth: { startScan: jest.fn(async () => {}) } };
var mockSyncResult = { sync: jest.fn(async () => {}) };
var mockStates: DownloaderState[] = [];
/* eslint-enable no-var */

jest.mock('@/providers/registry/useApi', () => ({ useApi: () => mockApi }));
jest.mock('@/features/library/useSync', () => ({ useSync: () => mockSyncResult }));
jest.mock('@/features/connectivity/useAppActive', () => ({ useAppActive: () => true }));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => false }));
// Ticking is not what this is about: one poll per mount is enough to show
// which order the answers land in.
jest.mock('@/state/query/usePollWhile', () => ({ usePollWhile: () => 0 }));
jest.mock('./registry', () => ({ useDownloaderStates: () => mockStates }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function item(id: string): DownloaderQueueItem {
  return {
    id,
    percentComplete: 10,
    title: `Album ${id}`,
    artistName: 'Someone',
    active: true,
    identity: 'exact',
    transferIds: [id],
  };
}

function state(
  id: 'lidarr' | 'slskd',
  label: string,
  fetchQueue: () => Promise<DownloaderQueueItem[]>
): DownloaderState {
  return {
    def: { id, label, fetchQueue } as unknown as DownloaderState['def'],
    config: { serverUrl: `http://${id}`, apiKey: 'key' },
    isConnected: true,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <DownloadersQueueProvider>{children}</DownloadersQueueProvider>
);

/**
 * The order downloaders are listed in is the registry's, not the order their
 * servers happened to answer in.
 *
 * `updateQueue` used to rebuild the array as "everyone else, then the one I
 * just refreshed", so each poll moved whichever downloader replied last to the
 * end. With two connected, the Home banner flipped between
 * "11 on Lidarr · 0 on slskd" and "0 on slskd · 11 on Lidarr" every thirty
 * seconds — a flicker in which not one count ever changed.
 */
describe('DownloadersQueueProvider ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists downloaders in registry order even when the slower one is first', async () => {
    const lidarrGate = deferred<DownloaderQueueItem[]>();
    mockStates = [
      state('lidarr', 'Lidarr', () => lidarrGate.promise),
      state('slskd', 'slskd', async () => []),
    ];

    const { result } = await renderHook(() => useDownloadersQueue(), { wrapper });

    // slskd answers immediately; Lidarr is still in flight.
    await waitFor(() => expect(result.current.queues).toHaveLength(1));
    expect(result.current.queues[0].id).toBe('slskd');

    await act(async () => { lidarrGate.resolve([item('a'), item('b')]); });
    await waitFor(() => expect(result.current.queues).toHaveLength(2));

    // Arriving last does not put Lidarr last.
    expect(result.current.queues.map((q) => q.id)).toEqual(['lidarr', 'slskd']);
    expect(result.current.totalInFlight).toBe(2);
  });

  it('keeps that order when the next read answers the other way round', async () => {
    mockStates = [
      state('lidarr', 'Lidarr', async () => [item('a')]),
      state('slskd', 'slskd', async () => []),
    ];

    const { result } = await renderHook(() => useDownloadersQueue(), { wrapper });
    await waitFor(() => expect(result.current.queues).toHaveLength(2));
    const first = result.current.queues.map((q) => q.id);

    // A second read of both, with no promise held open: whoever wins the race
    // this time, the list is the same list.
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(result.current.queues).toHaveLength(2));

    expect(result.current.queues.map((q) => q.id)).toEqual(first);
    expect(first).toEqual(['lidarr', 'slskd']);
  });
});

/**
 * What the Home banner counts is what is still moving. Downtify keeps a
 * finished job in its list until its history is cleared, and counting rows
 * left the banner spinning over downloads that had ended long ago (#304).
 */
describe('DownloadersQueueProvider in-flight count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts only active rows, while still listing the finished ones', async () => {
    mockStates = [
      state('lidarr', 'Lidarr', async () => [item('a'), { ...item('b'), active: false }]),
      state('slskd', 'slskd', async () => [{ ...item('c'), active: false }]),
    ];

    const { result } = await renderHook(() => useDownloadersQueue(), { wrapper });
    await waitFor(() => expect(result.current.queues).toHaveLength(2));

    expect(result.current.queues.map((q) => q.count)).toEqual([1, 0]);
    expect(result.current.queues.map((q) => q.items.length)).toEqual([2, 1]);
    expect(result.current.totalInFlight).toBe(1);
  });
});
