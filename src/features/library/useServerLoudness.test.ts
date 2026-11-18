import { renderHook } from '@testing-library/react-native';

import { useServerLoudness } from './useServerLoudness';

/**
 * #314 again, one step along: a server that *declares* loudness is not a
 * server that has any. Jellyfin only measures it from 10.10 and only for a
 * scanned library, so taking the declaration at face value would put the
 * levelling switch and its preamp back on screen with nothing to correct
 * towards — the original complaint, relocated.
 *
 * Shaped after `useServerSurface.test`: the query client is not under test,
 * so the hook's request is captured and the answer is whatever a test sets.
 */
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<boolean>; enabled: boolean }) => {
    mockQueries.push(options);
    return { data: mockData };
  },
}));
jest.mock('react-redux', () => ({ useSelector: () => ({ id: 'srv-1' }) }));
jest.mock('@/features/connectivity/useServerReachable', () => ({ useServerReachable: () => true }));
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => mockApi }));

/* eslint-disable no-var -- hoisted for the jest.mock factories above */
var mockQueries: { queryFn: () => Promise<boolean>; enabled: boolean }[] = [];
var mockData: boolean | undefined;
var mockApi: { songs: Record<string, unknown> } = { songs: {} };
/* eslint-enable no-var */

const lastQuery = () => mockQueries[mockQueries.length - 1];

describe('useServerLoudness', () => {
  beforeEach(() => {
    mockQueries = [];
    mockData = undefined;
    mockApi = { songs: {} };
  });

  it('offers nothing where the adapter reports no loudness, and asks nothing', async () => {
    mockApi = { songs: { reportsLoudness: false, probeLoudness: jest.fn() } };
    mockData = true;

    const { result } = await renderHook(() => useServerLoudness());

    expect(result.current).toBe(false);
    expect(lastQuery().enabled).toBe(false);
  });

  it('takes a provider with no probe at its word', async () => {
    // Navidrome: ReplayGain tags come from the files and the server reports
    // what it was given, so there is nothing to ask.
    mockApi = { songs: { reportsLoudness: true } };

    const { result } = await renderHook(() => useServerLoudness());

    expect(result.current).toBe(true);
    expect(lastQuery().enabled).toBe(false);
  });

  it('waits for the server before offering the switch', async () => {
    mockApi = { songs: { reportsLoudness: true, probeLoudness: jest.fn() } };
    mockData = undefined;

    const { result } = await renderHook(() => useServerLoudness());

    expect(result.current).toBe(false);
    expect(lastQuery().enabled).toBe(true);
  });

  it('offers it once the server returns a figure', async () => {
    mockApi = { songs: { reportsLoudness: true, probeLoudness: jest.fn() } };
    mockData = true;

    const { result } = await renderHook(() => useServerLoudness());

    expect(result.current).toBe(true);
  });

  it('keeps it out where the server returns none', async () => {
    // A Jellyfin before 10.10, or one whose library was never scanned.
    mockApi = { songs: { reportsLoudness: true, probeLoudness: jest.fn() } };
    mockData = false;

    const { result } = await renderHook(() => useServerLoudness());

    expect(result.current).toBe(false);
  });

  it('asks the adapter rather than deciding for itself', async () => {
    const probeLoudness = jest.fn().mockResolvedValue(true);
    mockApi = { songs: { reportsLoudness: true, probeLoudness } };

    await renderHook(() => useServerLoudness());
    await expect(lastQuery().queryFn()).resolves.toBe(true);

    expect(probeLoudness).toHaveBeenCalled();
  });
});
