import React from 'react';
import { render, act } from '@testing-library/react-native';

let mockFetching = 0;
jest.mock('@tanstack/react-query', () => ({
  useIsFetching: () => mockFetching,
}));

import { REFRESH_SETTLE_FALLBACK_MS, RefreshSettler } from './RefreshSettler';

/**
 * Home's pull-to-refresh ends when its fetches do.
 *
 * The fetch count moved out of `Home` into this component, mounted only while
 * refreshing, because reading it in `Home` re-rendered the whole feed on every
 * fetch in the app — several of them at every track change.
 */
describe('RefreshSettler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetching = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('settles once the fetches it saw start have all finished', async () => {
    const onSettled = jest.fn();
    mockFetching = 2;
    const view = await render(<RefreshSettler onSettled={onSettled} />);
    expect(onSettled).not.toHaveBeenCalled();

    mockFetching = 1;
    await view.rerender(<RefreshSettler onSettled={onSettled} />);
    expect(onSettled).not.toHaveBeenCalled();

    mockFetching = 0;
    await view.rerender(<RefreshSettler onSettled={onSettled} />);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('does not settle early just because nothing has started yet', async () => {
    const onSettled = jest.fn();
    await render(<RefreshSettler onSettled={onSettled} />);
    await act(async () => { jest.advanceTimersByTime(REFRESH_SETTLE_FALLBACK_MS - 1); });
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('gives up after the fallback when everything was still fresh', async () => {
    const onSettled = jest.fn();
    await render(<RefreshSettler onSettled={onSettled} />);
    await act(async () => { jest.advanceTimersByTime(REFRESH_SETTLE_FALLBACK_MS); });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('does not also fire the fallback once a fetch has started', async () => {
    const onSettled = jest.fn();
    mockFetching = 1;
    await render(<RefreshSettler onSettled={onSettled} />);
    await act(async () => { jest.advanceTimersByTime(REFRESH_SETTLE_FALLBACK_MS * 2); });
    expect(onSettled).not.toHaveBeenCalled();
  });
});
