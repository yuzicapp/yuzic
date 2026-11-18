import { createLog, type Log } from './log';
import { createPersistence, FLUSH_DEBOUNCE_MS, type Persistence } from './store';
import type { LogRecord } from './record';

/**
 * A log and a storage per test, both real, neither shared. The storage is a
 * plain Map behind the same three methods MMKV offers, so the serialising and
 * the parsing under test are the real ones.
 */
function fakeStorage() {
  const values = new Map<string, string>();
  return {
    values,
    set: jest.fn((key: string, value: string) => void values.set(key, value)),
    getString: (key: string) => values.get(key),
    clearAll: () => values.clear(),
  };
}

describe('diagnostics persistence', () => {
  let log: Log;
  let storage: ReturnType<typeof fakeStorage>;
  let persistence: Persistence;
  let detach: (() => void) | null = null;

  const stored = (): unknown => {
    const raw = storage.values.get('records');
    return raw ? JSON.parse(raw) : undefined;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    log = createLog();
    log.setLevel('debug');
    storage = fakeStorage();
    persistence = createPersistence(log, storage);
  });

  afterEach(() => {
    detach?.();
    detach = null;
    jest.useRealTimers();
  });

  it('writes nothing until the debounce elapses', () => {
    detach = persistence.install();
    log.playback.error('failed');

    expect(stored()).toBeUndefined();
  });

  it('writes once the debounce elapses', () => {
    detach = persistence.install();
    log.playback.error('failed');
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);

    expect(stored()).toEqual([expect.objectContaining({ message: 'failed' })]);
  });

  /**
   * The reason the write is debounced at all: a failing stream was measured at
   * 121 failures a minute, and this is the 121 serialisations of the whole
   * buffer that would otherwise be.
   */
  it('coalesces a burst into a single write', () => {
    detach = persistence.install();

    for (let index = 0; index < 100; index += 1) log.playback.error('failed', { index });
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);

    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('writes immediately when asked, for a handler about to restart the app', () => {
    detach = persistence.install();
    log.crash.error('fatal');
    persistence.flushNow();

    expect(stored()).toEqual([expect.objectContaining({ message: 'fatal' })]);
  });

  it('reads the previous session back into a new log', () => {
    detach = persistence.install();
    log.crash.error('from the session that died');
    persistence.flushNow();

    const next = createLog();
    createPersistence(next, storage).restore();

    expect(next.records().map((r: LogRecord) => r.message)).toEqual([
      'from the session that died',
    ]);
  });

  it('keeps credentials out of what reaches disk', () => {
    detach = persistence.install();
    log.server.error('could not open', {
      url: 'https://music.example.com/rest/stream.view?u=zack&t=26719a1196d2a940705a59634eb18eab',
    });
    persistence.flushNow();

    expect(JSON.stringify(stored())).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  describe('reading back what another version wrote', () => {
    it.each([
      ['not JSON', 'not json at all'],
      ['not an array', '{"message":"lonely"}'],
      ['null', 'null'],
    ])('starts empty rather than throwing on %s', (_name, raw) => {
      storage.values.set('records', raw);

      expect(() => persistence.restore()).not.toThrow();
      expect(log.records()).toEqual([]);
    });

    it('drops entries that are not records, keeping the ones that are', () => {
      storage.values.set(
        'records',
        JSON.stringify([
          { at: 1, level: 'warn', scope: 'playback', message: 'good' },
          { at: 2, level: 'nonsense', scope: 'playback', message: 'bad level' },
          { at: 3, level: 'warn', scope: 'not-a-scope', message: 'bad scope' },
          { message: 'no level or scope' },
          null,
          'a string',
        ])
      );

      persistence.restore();

      expect(log.records().map((r: LogRecord) => r.message)).toEqual(['good']);
    });
  });

  it('forgets everything on clear, on disk and in memory', () => {
    detach = persistence.install();
    log.app.info('private');
    persistence.flushNow();

    persistence.clear();

    expect(stored()).toBeUndefined();
    expect(log.records()).toEqual([]);
  });

  it('does not write after a pending flush is cancelled by a clear', () => {
    detach = persistence.install();
    log.app.info('private');
    persistence.clear();
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);

    expect(stored()).toBeUndefined();
  });

  it('survives storage that throws, rather than taking the app with it', () => {
    const broken = { ...fakeStorage(), set: () => { throw new Error('disk full'); } };
    const resilient = createPersistence(log, broken);
    detach = resilient.install();

    log.app.error('still buffered');

    expect(() => resilient.flushNow()).not.toThrow();
    expect(log.records()).toHaveLength(1);
  });
});
