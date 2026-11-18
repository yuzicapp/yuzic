import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getBackend } from '@/features/player/activeBackend';
import { getMediaItemUrl } from '@/features/playback/playableMedia';
import type { MediaItem } from '@/features/player/mediaItem';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

// ─── DLNA ────────────────────────────────────────────────────────────────────

interface DlnaDevice {
  name: string;
  udn: string;
  avTransportUrl: string;
}

/**
 * DLNA casts a bare URL to a renderer over SOAP and has no way to send request
 * headers with it. A track that needs an `Authorization` header — a Plex behind
 * a Basic-auth proxy — would 401 at the renderer, so it must not be cast as a
 * URL that silently fails. Gate on the header the resolution path attaches
 * rather than re-deriving the server type here.
 */
function requiresHeadersToPlay(item: MediaItem | null): boolean {
  return !!item?.headers && Object.keys(item.headers).length > 0;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// fetch() normalizes header names to lowercase, which breaks LG and other devices
// that do case-sensitive SOAP header matching. XMLHttpRequest preserves exact casing.
function soapAction(url: string, service: string, action: string, body: string): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('SOAPAction', `"urn:schemas-upnp-org:service:${service}:1#${action}"`);
    xhr.onload = () => {
      const responseText = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: () => Promise.resolve(responseText),
      });
    };
    xhr.onerror = () => reject(new Error('SOAP network error'));
    xhr.ontimeout = () => reject(new Error('SOAP timeout'));
    xhr.timeout = 8000;
    xhr.send(`<?xml version="1.0"?><s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action} xmlns:u="urn:schemas-upnp-org:service:${service}:1">${body}</u:${action}></s:Body></s:Envelope>`);
  });
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface DlnaContextType {
  // DLNA
  activeDevice: DlnaDevice | null;
  isConnecting: boolean;
  connectToDevice(device: DlnaDevice): Promise<void>;
  disconnectDevice(): Promise<void>;

  // Shared controls (routed to whichever protocol is active)
  dlnaPause(): Promise<void>;
  dlnaResume(): Promise<void>;
  dlnaSeek(position: number): Promise<void>;
}

const DlnaContext = createContext<DlnaContextType>({
  activeDevice: null,
  isConnecting: false,
  connectToDevice: async () => {},
  disconnectDevice: async () => {},
  dlnaPause: async () => {},
  dlnaResume: async () => {},
  dlnaSeek: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DlnaProvider({ children }: { children: React.ReactNode }) {
  // DLNA state
  const [activeDevice, setActiveDevice] = useState<DlnaDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const activeDeviceRef = useRef<DlnaDevice | null>(null);
  useEffect(() => { activeDeviceRef.current = activeDevice; }, [activeDevice]);

  // When track changes, push new URL to the active renderer.
  useEffect(() => {
    // The backend's trackChange carries no payload — it says *that* the track
    // moved, not to what — so the new item is read back rather than unpacked
    // from the event. Same source of truth either way, and it avoids a second
    // definition of "the current track" that could disagree with the UI's.
    const unsubscribe = getBackend().addListener(async (event) => {
      if (event.type !== 'trackChange') return;
      const item = getBackend().getActiveMediaItem();
      // A header-authenticated track cannot be cast as a bare URL — the
      // renderer would 401. Leave it playing locally rather than pushing a URL
      // that will fail silently on the device.
      if (requiresHeadersToPlay(item)) return;
      const url = item ? getMediaItemUrl(item) : '';
      if (!url) return;

      const device = activeDeviceRef.current;
      if (!device) return;
      try {
        await soapAction(device.avTransportUrl, 'AVTransport', 'SetAVTransportURI',
          `<InstanceID>0</InstanceID><CurrentURI>${xmlEscape(url)}</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`
        );
        await soapAction(device.avTransportUrl, 'AVTransport', 'Play', `
          <InstanceID>0</InstanceID>
          <Speed>1</Speed>
        `);
      } catch (err) {
        log.player.warn('dlna track update failed', { detail: detailOf(err) });
      }
    });
    return unsubscribe;
  }, []);

  // ── DLNA connect/disconnect ──────────────────────────────────────────────

  const connectToDevice = useCallback(async (device: DlnaDevice) => {
    setIsConnecting(true);
    try {
      const currentTrack = getBackend().getActiveMediaItem();
      // See requiresHeadersToPlay: a Basic-auth Plex stream can't be cast to a
      // URL-only renderer. Fail the connect explicitly rather than casting a
      // URL that 401s with nothing to explain the silence.
      if (requiresHeadersToPlay(currentTrack)) {
        throw new Error('This server needs authentication that casting cannot send');
      }
      const currentUrl = currentTrack ? getMediaItemUrl(currentTrack) : '';
      if (!currentUrl) throw new Error('No active track to cast');

      const uriRes = await soapAction(device.avTransportUrl, 'AVTransport', 'SetAVTransportURI',
        `<InstanceID>0</InstanceID><CurrentURI>${xmlEscape(currentUrl)}</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`
      );
      if (!uriRes.ok) {
        const body = await uriRes.text();
        log.player.warn('dlna set transport uri failed', { status: uriRes.status, detail: body });
        throw new Error(`SetAVTransportURI ${uriRes.status}`);
      }

      const playRes = await soapAction(device.avTransportUrl, 'AVTransport', 'Play',
        `<InstanceID>0</InstanceID><Speed>1</Speed>`
      );
      if (!playRes.ok) {
        const body = await playRes.text();
        log.player.warn('dlna play failed', { status: playRes.status, detail: body });
        throw new Error(`Play ${playRes.status}`);
      }

      getBackend().setVolume(0);
      setActiveDevice(device);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    const device = activeDeviceRef.current;
    if (device) {
      try {
        await soapAction(device.avTransportUrl, 'AVTransport', 'Stop', `<InstanceID>0</InstanceID>`);
      } catch (err) {
        log.player.warn('dlna stop on disconnect failed', { detail: detailOf(err) });
      }
    }
    getBackend().setVolume(1);
    setActiveDevice(null);
  }, []);

  // ── Shared controls ──────────────────────────────────────────────────────

  const dlnaPause = useCallback(async () => {
    const device = activeDeviceRef.current;
    if (!device) return;
    try {
      await soapAction(device.avTransportUrl, 'AVTransport', 'Pause', `<InstanceID>0</InstanceID>`);
    } catch (err) {
      log.player.warn('dlna pause failed', { detail: detailOf(err) });
    }
  }, []);

  const dlnaResume = useCallback(async () => {
    const device = activeDeviceRef.current;
    if (!device) return;
    try {
      await soapAction(device.avTransportUrl, 'AVTransport', 'Play', `
        <InstanceID>0</InstanceID>
        <Speed>1</Speed>
      `);
    } catch (err) {
      log.player.warn('dlna resume failed', { detail: detailOf(err) });
    }
  }, []);

  const dlnaSeek = useCallback(async (position: number) => {
    const device = activeDeviceRef.current;
    if (!device) return;
    const h = Math.floor(position / 3600);
    const m = Math.floor((position % 3600) / 60);
    const s = Math.floor(position % 60);
    const ts = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    try {
      await soapAction(device.avTransportUrl, 'AVTransport', 'Seek', `
        <InstanceID>0</InstanceID>
        <Unit>REL_TIME</Unit>
        <Target>${ts}</Target>
      `);
    } catch (err) {
      log.player.warn('dlna seek failed', { detail: detailOf(err) });
    }
  }, []);

  return (
    <DlnaContext.Provider value={{
      activeDevice, isConnecting, connectToDevice, disconnectDevice,
      dlnaPause, dlnaResume, dlnaSeek,
    }}>
      {children}
    </DlnaContext.Provider>
  );
}

export const useDlna = () => useContext(DlnaContext);
