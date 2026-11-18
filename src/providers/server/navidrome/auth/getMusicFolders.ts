import { Server } from '@/providers/contracts/Server';
import { buildTokenParams } from '../client';
import { SubsonicResponse } from '../types';
import { serverFetch } from '@/features/mtls/serverFetch';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

const API_VERSION = '1.16.0';
const CLIENT_NAME = 'Yuzic';

export async function getMusicFolders(server: Server): Promise<{ id: string; name: string }[]> {
  const { serverUrl, username, auth } = server;
  const password = auth?.password as string | undefined;
  if (!serverUrl || !username || !password) return [];

  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const { u, t, s } = buildTokenParams(username, password);
  const params = new URLSearchParams({ u, t, s, v: API_VERSION, c: CLIENT_NAME, f: 'json' });

  try {
    const res = await serverFetch(`${cleanUrl}/rest/getMusicFolders.view?${params}`);
    if (!res.ok) return [];
    const data: SubsonicResponse = await res.json();
    const response = data['subsonic-response'];
    if (response?.status !== 'ok') return [];

    const rawFolders = response?.musicFolders?.musicFolder;
    const folderList = Array.isArray(rawFolders) ? rawFolders : rawFolders ? [rawFolders] : [];

    return folderList
      .map((folder, index) => {
        const id = String(folder?.id ?? '').trim();
        const name = String(folder?.name ?? folder?.title ?? (id ? `Library ${index + 1}` : '')).trim();
        if (!id) return null;
        return { id, name: name || `Library ${index + 1}` };
      })
      .filter((folder): folder is { id: string; name: string } => folder !== null);
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getMusicFolders', detail: detailOf(error) });
    throw error;
  }
}
