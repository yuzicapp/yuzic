import { createLog, type Log } from './log';
import type { LogRecord } from './record';

const TOKEN_URL =
  'https://music.example.com/rest/stream.view?u=zack&t=26719a1196d2a940705a59634eb18eab&s=c19b2d';

describe('log', () => {
  // A fresh instance per test rather than a shared one reset between them —
  // which is the reason `createLog` exists; see `log.ts`.
  let log: Log;
  const records = (): LogRecord[] => log.records();

  beforeEach(() => {
    log = createLog();
    log.setLevel('debug');
  });

  it('records a message with its scope and level', () => {
    log.playback.warn('stream stalled', { songId: '42' });

    expect(records()).toEqual([
      expect.objectContaining({
        level: 'warn',
        scope: 'playback',
        message: 'stream stalled',
        fields: { songId: '42' },
      }),
    ]);
  });

  it('stamps a time, so an export is orderable', () => {
    log.app.info('started');
    expect(records()[0].at).toBeGreaterThan(0);
  });

  it('keeps records in the order they were written', () => {
    log.app.info('first');
    log.server.error('second');

    expect(records().map((r: LogRecord) => r.message)).toEqual(['first', 'second']);
  });

  /**
   * The guarantee the whole design rests on: nothing reaches a sink, or the
   * buffer, before `scrub` has had it. See `scrub.ts`.
   */
  it('scrubs before anything is stored', () => {
    log.server.error('could not open', { url: TOKEN_URL });

    expect(JSON.stringify(records())).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  it('scrubs before a sink sees it', () => {
    const seen: LogRecord[] = [];
    const detach = log.addSink((record: LogRecord) => seen.push(record));

    log.server.error(`failed on ${TOKEN_URL}`);
    detach();

    expect(seen).toHaveLength(1);
    expect(JSON.stringify(seen[0])).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  describe('levels', () => {
    it('drops anything below the threshold', () => {
      log.setLevel('warn');

      log.playback.debug('noise');
      log.playback.info('also noise');
      log.playback.warn('kept');
      log.playback.error('kept too');

      expect(records().map((r: LogRecord) => r.message)).toEqual(['kept', 'kept too']);
    });

    it('keeps everything at debug', () => {
      log.setLevel('debug');
      log.playback.debug('kept');

      expect(records()).toHaveLength(1);
    });

    it('does not evaluate a dropped record at all', () => {
      log.setLevel('error');
      const fields = { get songId(): string { throw new Error('should not be read'); } };

      expect(() => log.playback.debug('dropped', fields as never)).not.toThrow();
      expect(records()).toHaveLength(0);
    });
  });

  describe('sinks', () => {
    it('stops delivering once detached', () => {
      const seen: string[] = [];
      const detach = log.addSink((record: LogRecord) => seen.push(record.message));

      log.app.info('before');
      detach();
      log.app.info('after');

      expect(seen).toEqual(['before']);
    });

    it('delivers to every attached sink', () => {
      const a: string[] = [];
      const b: string[] = [];
      const detachA = log.addSink((r: LogRecord) => a.push(r.message));
      const detachB = log.addSink((r: LogRecord) => b.push(r.message));

      log.app.info('both');
      detachA();
      detachB();

      expect(a).toEqual(['both']);
      expect(b).toEqual(['both']);
    });

    /**
     * A sink is the diagnostics UI, or a store write. Either can fail, and a
     * log line is never important enough to crash the thing it describes.
     */
    it('survives a sink that throws, and still records', () => {
      const detachBad = log.addSink(() => {
        throw new Error('sink is broken');
      });

      expect(() => log.player.error('still logged')).not.toThrow();
      detachBad();

      expect(records().map((r: LogRecord) => r.message)).toEqual(['still logged']);
    });

    it('still reaches the other sinks when one throws', () => {
      const seen: string[] = [];
      const detachBad = log.addSink(() => {
        throw new Error('sink is broken');
      });
      const detachGood = log.addSink((r: LogRecord) => seen.push(r.message));

      log.player.error('delivered');
      detachBad();
      detachGood();

      expect(seen).toEqual(['delivered']);
    });
  });

  describe('a sink that logs', () => {
    /**
     * The loop this guards against was found on a device: React Native
     * reports `console.error` through `ExceptionsManager` to the global error
     * handler, the app's handler logs what it receives, and the development
     * console sink prints error records with `console.error`. One non-fatal
     * error filled all 400 slots of the ring with copies of itself inside a
     * single millisecond.
     */
    it('does not recurse, and keeps the record that started it', () => {
      const detach = log.addSink(record => {
        if (record.message === 'original') log.player.error('caused by the sink');
      });

      expect(() => log.crash.error('original')).not.toThrow();
      detach();

      expect(records().map((r: LogRecord) => r.message)).toEqual(['original']);
    });

    it('survives a sink that logs on every record, rather than looping forever', () => {
      const detach = log.addSink(() => log.app.warn('echo'));

      log.crash.error('first');
      log.crash.error('second');
      detach();

      expect(records().map((r: LogRecord) => r.message)).toEqual(['first', 'second']);
    });

    it('logs normally again once delivery has finished', () => {
      const detach = log.addSink(() => log.app.warn('echo'));
      log.crash.error('during');
      detach();

      log.app.info('after');

      expect(records().map((r: LogRecord) => r.message)).toEqual(['during', 'after']);
    });
  });

  it('clears on request, for a user who does not want to send history', () => {
    log.app.info('private');
    log.clear();

    expect(records()).toEqual([]);
  });
});
