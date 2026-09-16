import { useSyncExternalStore } from 'react';

/**
 * Asking to connect a downloader from where one was needed.
 *
 * "Download to your server" used to sit greyed out with nothing connected and
 * swallow the tap, so it read as broken rather than as a step not yet taken. A
 * feature calls `promptConnectDownloader` instead, and the one host at the root
 * says what a downloader is and offers the ones that can take the request.
 *
 * The same shape as `sourceUsePrompt` — a plain store and a single host — but
 * its own: a downloader is a service you run and connect to, not an outside
 * source's use that a switch turns on.
 */

/**
 * What is being asked for, so only downloaders that take it are offered.
 *
 * `artist` is not a thing to fetch but a thing to follow, and only a
 * collection manager has any concept of one — so it offers a different, and
 * usually shorter, list than the two release units.
 */
type DownloadUnit = 'album' | 'track' | 'artist';

let pending: DownloadUnit | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => pending;

/** Asks to connect a downloader that can take this unit. A second ask replaces the first. */
export function promptConnectDownloader(unit: DownloadUnit): void {
  pending = unit;
  emit();
}

export function dismissConnectDownloaderPrompt(): void {
  if (pending === null) return;
  pending = null;
  emit();
}

/** The unit being asked about, for the host. */
export const usePendingDownloaderPrompt = (): DownloadUnit | null =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
