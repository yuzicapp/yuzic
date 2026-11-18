import { useState, useCallback, useRef } from 'react';
import UdpSockets from "react-native-udp";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

export interface DiscoveredDevice {
  name: string;
  udn: string;
  location: string;
  avTransportUrl: string;
}

const SSDP_MULTICAST = '239.255.255.250';
const SSDP_PORT = 1900;
const SCAN_DURATION_MS = 5000;

const M_SEARCH = [
  'M-SEARCH * HTTP/1.1',
  `HOST: ${SSDP_MULTICAST}:${SSDP_PORT}`,
  'MAN: "ssdp:discover"',
  'MX: 3',
  'ST: ssdp:all',
  '',
  '',
].join('\r\n');

function parseLocation(response: string): string | null {
  const match = response.match(/^LOCATION:\s*(.+)$/im);
  return match?.[1]?.trim() ?? null;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

async function resolveDevice(location: string): Promise<DiscoveredDevice | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(location, { signal: controller.signal }).finally(() => clearTimeout(timer));
    const xml = await res.text();

    if (!xml.includes('AVTransport')) return null;

    const name = extractTag(xml, 'friendlyName') || 'Unknown Device';
    const udn = extractTag(xml, 'UDN');

    const avTransportMatch = xml.match(/AVTransport[\s\S]*?<controlURL>([^<]+)<\/controlURL>/i);
    if (!avTransportMatch) return null;

    const controlPath = avTransportMatch[1].trim();
    const base = new URL(location);
    const avTransportUrl = controlPath.startsWith('http')
      ? controlPath
      : `${base.protocol}//${base.host}${controlPath.startsWith('/') ? '' : '/'}${controlPath}`;

    return { name, udn, location, avTransportUrl };
  } catch {
    return null;
  }
}

const PROBE_PORTS = [1505, 36866, 8200, 8080, 44444, 49152, 49153, 49154, 49155, 1400];
const PROBE_PATHS = ['/dmr', '/description.xml', '/', '/upnp/desc.html'];

async function probeIp(ip: string): Promise<DiscoveredDevice | null> {
  const attempts = PROBE_PORTS.flatMap(port =>
    PROBE_PATHS.map(path => `http://${ip.trim()}:${port}${path}`)
  );
  const results = await Promise.allSettled(attempts.map(url => resolveDevice(url)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

export function useDlnaDiscovery() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const isScanningRef = useRef(false);

  const probeManual = useCallback(async (ip: string): Promise<DiscoveredDevice | null> => {
    setIsProbing(true);
    try {
      const device = await probeIp(ip);
      if (device) {
        setDevices(prev => prev.some(d => d.udn === device.udn) ? prev : [...prev, device]);
      }
      return device;
    } finally {
      setIsProbing(false);
    }
  }, []);

  const scan = useCallback(() => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    setDevices([]);

    const seen = new Set<string>();
    const pending: Promise<void>[] = [];

    const socket = UdpSockets.createSocket({ type: 'udp4', reusePort: true });

    socket.on('error', (err: Error) => {
      log.player.warn('dlna socket error', { detail: detailOf(err) });
    });

    // Track IPs that have responded — probe them for renderer ports after SSDP
    const respondedIps = new Set<string>();

    socket.on('message', (msg: Buffer, rinfo: { address: string; port: number }) => {
      const text = msg.toString();
      const location = parseLocation(text);
      if (!location) return;

      const ip = rinfo?.address;

      // Queue a direct probe on renderer ports for this IP if not already doing so.
      // LG TVs often don't include their renderer in all SSDP responses.
      if (ip && !respondedIps.has(ip)) {
        respondedIps.add(ip);
        const probe = probeIp(ip).then(device => {
          if (!device) return;
          setDevices(prev => {
            if (prev.some(d => d.udn === device.udn)) return prev;
            return [...prev, device];
          });
        });
        pending.push(probe);
      }

      if (seen.has(location)) return;
      seen.add(location);

      const p = resolveDevice(location).then(device => {
        if (!device) return;
        setDevices(prev => {
          if (prev.some(d => d.udn === device.udn)) return prev;
          return [...prev, device];
        });
      });
      pending.push(p);
    });

    socket.on('listening', () => {
      try {
        socket.addMembership(SSDP_MULTICAST);
      } catch {
        // Some platforms reject addMembership when a route is already
        // joined; SSDP unicast responses still arrive without it.
      }
      socket.send(M_SEARCH, 0, M_SEARCH.length, SSDP_PORT, SSDP_MULTICAST, (err?: Error) => {
        if (err) log.player.warn('dlna m-search send failed', { detail: detailOf(err) });
      });
    });

    socket.bind(0);

    setTimeout(async () => {
      try { socket.close(); } catch {}
      await Promise.allSettled(pending);
      isScanningRef.current = false;
      setIsScanning(false);
    }, SCAN_DURATION_MS);
  }, []);

  return { devices, isScanning, isProbing, scan, probeManual };
}
