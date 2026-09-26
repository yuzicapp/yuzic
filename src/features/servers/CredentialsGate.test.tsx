import React from 'react';
import { Text } from '@/components/Text';
import { act, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { CredentialsGate } from './CredentialsGate';
import serversReducer, { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import type { Server } from '@/providers/contracts/Server';

let finishHydration: (outcome: 'resolve' | 'reject') => void = () => {};
const mockHydrateAll = jest.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      finishHydration = outcome => (outcome === 'resolve' ? resolve() : reject(new Error('keystore locked')));
    })
);
jest.mock('@/state/credentialCache', () => ({
  hydrateAll: (...args: unknown[]) => mockHydrateAll(...(args as [])),
}));

const mockHideSplash = jest.fn();
jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHideSplash() }));

const SERVER_ID = 'server-1';

function testServer(): Server {
  return {
    id: SERVER_ID,
    type: 'navidrome',
    serverUrl: 'https://example.com',
    username: 'u',
    isAuthenticated: true,
  };
}

async function renderGate() {
  const store = configureStore({ reducer: { servers: serversReducer } });
  store.dispatch(addServer(testServer()));
  store.dispatch(setActiveServer(SERVER_ID));
  const utils = await render(
    <Provider store={store}>
      <CredentialsGate><Text>app</Text></CredentialsGate>
    </Provider>
  );
  return utils;
}

/**
 * The app used to render while the keystore read was in flight, and everything
 * that mounted first asked its server with an empty password. A Subsonic server
 * refuses that with 200 OK, and the catalog cached the refusal as an empty
 * library under `staleTime: Infinity` — Albums stayed empty after a cold start.
 */
describe('CredentialsGate', () => {
  beforeEach(() => {
    mockHydrateAll.mockClear();
    mockHideSplash.mockClear();
  });

  it('renders nothing, and keeps the splash up, until the keystore read lands', async () => {
    const { queryByText } = await renderGate();

    expect(mockHydrateAll).toHaveBeenCalledTimes(1);
    expect(queryByText('app')).toBeNull();
    expect(mockHideSplash).not.toHaveBeenCalled();

    await act(async () => { finishHydration('resolve'); });

    expect(queryByText('app')).not.toBeNull();
    expect(mockHideSplash).toHaveBeenCalled();
  });

  it('reads every scope the active servers own', async () => {
    await renderGate();
    const scopes = (mockHydrateAll.mock.calls[0] as unknown as [unknown[]])[0];
    expect(scopes.length).toBeGreaterThan(1);
    expect(JSON.stringify(scopes)).toContain(SERVER_ID);
  });

  it('still opens the app when the keystore cannot be read, and says why', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { queryByText } = await renderGate();

    await act(async () => { finishHydration('reject'); });

    expect(queryByText('app')).not.toBeNull();
    expect(warn).toHaveBeenCalledWith('[credentials] keystore read failed', expect.any(Error));
    warn.mockRestore();
  });
});
