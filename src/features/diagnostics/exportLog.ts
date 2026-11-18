import { Platform, Share } from 'react-native';

import { APP_VERSION } from '@/constants/appVersion';
import { log } from './log';
import type { LogRecord } from './record';

/**
 * The log, as something a person can paste into an issue.
 *
 * Plain text rather than JSON, because that is what it is for: the bug
 * template asks for logs, reporters answer "_No response_" because there is
 * nothing to give, and what they will do with this is paste it into a comment
 * box. NDJSON would be tidier to parse and worse to read, and nobody is
 * parsing it.
 *
 * **The header is the report's first three questions.** App version,
 * platform, OS version and backend are the first four fields of the issue
 * template, and every one of them is something a reporter can get wrong or
 * leave blank. Taken from the device, they are right.
 *
 * **The server's address is deliberately not here.** The backend *type* is
 * diagnostic; the host is the user's own machine, and this text is going
 * somewhere public. Records reaching this point have already been through
 * `scrub`, so a URL inside one has lost its credentials and its query, but
 * there is no reason to add the host back in a header.
 */

interface ExportMeta {
  /** 'navidrome', 'jellyfin', … — the type, never the address. */
  backend?: string;
}

/** `20:14:03.123` — a wall clock, because a reporter describes when it happened. */
function timeOf(at: number): string {
  const d = new Date(at);
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function fieldsOf(record: LogRecord): string {
  if (!record.fields) return '';
  const pairs = Object.entries(record.fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length ? `  ${pairs.join(' ')}` : '';
}

/** One record, one line — except a field that holds a stack, which keeps its own. */
export function formatRecord(record: LogRecord): string {
  return `${timeOf(record.at)} ${record.level.toUpperCase().padEnd(5)} [${record.scope}] ${record.message}${fieldsOf(record)}`;
}

export function formatExport(records: readonly LogRecord[], meta: ExportMeta = {}): string {
  const header = [
    `Yuzic ${APP_VERSION}`,
    `${Platform.OS} ${String(Platform.Version)}`,
    meta.backend ?? 'no server',
  ].join(' · ');

  if (records.length === 0) return `${header}\n\nNo records.`;

  const first = new Date(records[0].at).toISOString();
  const last = new Date(records[records.length - 1].at).toISOString();

  return [
    header,
    `${records.length} record${records.length === 1 ? '' : 's'}, ${first} to ${last}`,
    '',
    ...records.map(formatRecord),
  ].join('\n');
}

/**
 * Hands the formatted log to the OS share sheet.
 *
 * As a message rather than a file: a file needs `expo-sharing` and gives a
 * reporter an attachment to find, while a message pastes straight into the
 * comment box they are already typing in. Not `features/shares/shareItem`,
 * which exists for a Subsonic share *link* and requires a URL.
 *
 * Returns whether the user went through with it, so the screen can say so.
 */
export async function shareLog(meta: ExportMeta = {}): Promise<boolean> {
  try {
    const result = await Share.share({
      message: formatExport(log.records(), meta),
      title: 'Yuzic diagnostics',
    });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
