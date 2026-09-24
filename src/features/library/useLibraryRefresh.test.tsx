import { renderHook, act, waitFor } from '@testing-library/react-native'

const mockSync = jest.fn(async () => {})
const mockState = { offline: false }

jest.mock('@/features/library/useSync', () => ({ useSync: () => ({ sync: mockSync }) }))
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => mockState.offline }))

import { useLibraryRefresh } from './useLibraryRefresh'

/**
 * The catalog never refetches on its own — the screens read it at
 * `staleTime: Infinity` and `useSync` is throttled to half an hour — so a pull
 * has to force the sync or it is a no-op on a list the user is staring at.
 */
describe('library pull-to-refresh', () => {
  beforeEach(() => {
    mockSync.mockClear()
    mockState.offline = false
  })

  it('forces the sync, bypassing the throttle', async () => {
    const { result } = await renderHook(() => useLibraryRefresh())

    await act(async () => { await result.current.onRefresh() })

    expect(mockSync).toHaveBeenCalledWith(true)
  })

  it('does not ask an unreachable server — offline the list on screen is the answer', async () => {
    mockState.offline = true
    const { result } = await renderHook(() => useLibraryRefresh())

    await act(async () => { await result.current.onRefresh() })

    expect(mockSync).not.toHaveBeenCalled()
    expect(result.current.refreshing).toBe(false)
  })

  it('ends the spinner when the sync fails, rather than leaving it turning', async () => {
    mockSync.mockRejectedValueOnce(new Error('server said no'))
    const { result } = await renderHook(() => useLibraryRefresh())

    await act(async () => { await result.current.onRefresh().catch(() => {}) })

    await waitFor(() => expect(result.current.refreshing).toBe(false))
  })
})
