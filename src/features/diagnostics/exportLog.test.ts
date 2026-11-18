import type { LogRecord } from './record';

// The app version comes from the Expo manifest, and Jest cannot parse
// `expo-constants` outside the app's own transform pipeline — the same reason
// `settings/home/index.test.tsx` mocks it. Pinned here so the header
// assertions below are about the format rather than about this machine.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.17.1' } },
}));

import { formatExport, formatRecord } from './exportLog';

const at = Date.UTC(2026, 10, 17, 12, 0, 0);

const record = (over: Partial<LogRecord> = {}): LogRecord => ({
  at,
  level: 'error',
  scope: 'playback',
  message: 'playback failed',
  ...over,
});

describe('formatRecord', () => {
  it('reads as one line: time, level, scope, message', () => {
    expect(formatRecord(record())).toContain('ERROR [playback] playback failed');
  });

  it('puts the fields after the message as key=value', () => {
    const line = formatRecord(
      record({ fields: { code: 'PLAYBACK_FAILED', songId: '42', position: 57.2 } })
    );

    expect(line).toContain('code=PLAYBACK_FAILED');
    expect(line).toContain('songId=42');
    expect(line).toContain('position=57.2');
  });

  it('keeps false, which is a fact, and drops empty, which is not', () => {
    const line = formatRecord(record({ fields: { fatal: false, title: '', code: 'X' } }));

    expect(line).toContain('fatal=false');
    expect(line).not.toContain('title=');
  });

  it('drops a field the caller left undefined', () => {
    expect(formatRecord(record({ fields: { code: 'X', songId: undefined } })))
      .not.toContain('songId');
  });

  it('pads the level so the columns line up down the page', () => {
    const lines = [formatRecord(record({ level: 'warn' })), formatRecord(record({ level: 'error' }))];
    const scopeAt = lines.map(line => line.indexOf('[playback]'));

    expect(scopeAt[0]).toBe(scopeAt[1]);
  });
});

describe('formatExport', () => {
  /**
   * The header answers the issue template's first four fields from the device
   * rather than from the reporter, who can get any of them wrong.
   */
  it('leads with the app version, platform and backend', () => {
    const out = formatExport([record()], { backend: 'navidrome' });

    expect(out.split('\n')[0]).toContain('Yuzic 2.17.1');
    expect(out.split('\n')[0]).toContain('navidrome');
  });

  it('says so when there is no server, rather than leaving a gap', () => {
    expect(formatExport([record()])).toContain('no server');
  });

  it('counts the records and gives the span they cover', () => {
    const out = formatExport([record(), record({ at: at + 5000 })]);

    expect(out).toContain('2 records');
    expect(out).toContain('2026-11-17T12:00:00.000Z');
    expect(out).toContain('2026-11-17T12:00:05.000Z');
  });

  it('says the count in the singular for one record', () => {
    expect(formatExport([record()])).toContain('1 record,');
  });

  it('still produces a usable report when the log is empty', () => {
    const out = formatExport([]);

    expect(out).toContain('Yuzic');
    expect(out).toContain('No records.');
  });

  it('keeps the records in the order they happened', () => {
    const out = formatExport([
      record({ message: 'first' }),
      record({ at: at + 1000, message: 'second' }),
    ]);

    expect(out.indexOf('first')).toBeLessThan(out.indexOf('second'));
  });

  /**
   * Belt and braces: records are scrubbed on the way into the log, so nothing
   * here should have a credential left to lose. This asserts the export adds
   * none back — the host, for instance, is deliberately not in the header.
   */
  it('does not reintroduce anything secret', () => {
    const out = formatExport(
      [record({ fields: { url: 'https://music.example.com/rest/stream.view?<redacted>(3)' } })],
      { backend: 'navidrome' }
    );

    expect(out).toContain('music.example.com/rest/stream.view');
    expect(out).toContain('<redacted>(3)');
  });
});
