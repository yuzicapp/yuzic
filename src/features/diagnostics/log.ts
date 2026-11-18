import { Ring } from './ring';
import { scrub } from './scrub';
import { levelRank, SCOPES, type Fields, type Level, type LogRecord, type Scope } from './record';

/**
 * The log.
 *
 * `log.playback.warn('stream stalled', { songId, position })` — a scope, a
 * level, a fixed message and fields. What it is *not* is a nicer `console`: a
 * record goes to a bounded buffer the diagnostics export reads, which is the
 * whole point. The app had 56 `console.warn`/`console.error` sites, every one
 * a deliberate failure report and every one writing where no user and no
 * maintainer could reach it. The worst was `ErrorBoundary`, which caught the
 * crash that shipped as #325 and handed the component stack naming its cause
 * to `console.error`.
 *
 * **A created instance, not a module singleton.** `createLog()` exists because
 * the controls a log needs — set the level, clear it, read it back — are the
 * controls a *test* needs too, and as module exports they were exports with no
 * caller outside tests, which this repo's `test-only-exports` gate rightly
 * refuses. As instance methods they are the same API for both, and each test
 * builds its own log instead of resetting shared state between them. The app
 * uses the one instance below.
 *
 * **Scrubbed once, here.** Every record passes `scrub` inside `emit`, before
 * the buffer and before any sink, so no sink and no later reader has to know
 * credentials were ever a possibility. See `scrub.ts` for why that has to
 * happen on the way in rather than on the way out.
 */

type Sink = (record: LogRecord) => void;

interface ScopedLogger {
  debug: (message: string, fields?: Fields) => void;
  info: (message: string, fields?: Fields) => void;
  warn: (message: string, fields?: Fields) => void;
  error: (message: string, fields?: Fields) => void;
}

interface Controls {
  /** The records held right now, oldest first. */
  records: () => LogRecord[];
  /** Forgets everything held in memory. */
  clear: () => void;
  /** Replaces the contents — the persisted store restoring a session. */
  load: (stored: readonly LogRecord[]) => void;
  addSink: (sink: Sink) => () => void;
  setLevel: (level: Level) => void;
  getLevel: () => Level;
}

/**
 * A scope's name can never collide with a control's: `Scope` is a closed union
 * and none of its members is `records`, `clear`, `load`, `addSink`,
 * `setLevel` or `getLevel`. TypeScript enforces that the moment one is added.
 */
export type Log = Record<Scope, ScopedLogger> & Controls;

export function createLog(capacity?: number): Log {
  const ring = new Ring(capacity);
  const sinks = new Set<Sink>();

  /**
   * Below this, a call returns before it formats anything. `debug` is kept out
   * of release builds: the point of a level is that a cheap call in a hot path
   * costs nothing when nobody is reading, and `onProgress` fires several times
   * a second.
   */
  let threshold: Level = __DEV__ ? 'debug' : 'info';

  /**
   * True while a record is being delivered, so a log caused *by* logging is
   * dropped instead of recursing.
   *
   * Found on a device, not in a test. React Native reports `console.error`
   * through `ExceptionsManager`, which reaches the global error handler —
   * measured: one `console.error` fires it exactly once. The app's fatal
   * handler logs what it is given, the development console sink prints an
   * error-level record with `console.error`, and that is a closed loop. One
   * non-fatal error filled all 400 slots of the ring with copies of itself,
   * at a single millisecond, destroying the context that would have explained
   * it — the opposite of this feature's purpose.
   *
   * Guarded here rather than in the sink, because the loop is not the console
   * sink's to own: any sink that can cause a log — a store write that fails,
   * a future reporter — closes the same circle. The first record is kept and
   * the recursive ones are dropped, which is the right way round.
   */
  let emitting = false;

  const emit = (level: Level, scope: Scope, message: string, fields?: Fields): void => {
    if (levelRank(level) < levelRank(threshold)) return;
    if (emitting) return;

    emitting = true;
    try {
      const record = scrub({ at: Date.now(), level, scope, message, fields });

      ring.push(record);
      for (const sink of sinks) {
        try {
          sink(record);
        } catch {
          // A sink that throws must not take down the thing it was logging
          // about. Deliberately silent: reporting it through this log would be
          // the same call again, one frame deeper.
        }
      }
    } finally {
      emitting = false;
    }
  };

  const scoped = (scope: Scope): ScopedLogger => ({
    debug: (message, fields) => emit('debug', scope, message, fields),
    info: (message, fields) => emit('info', scope, message, fields),
    warn: (message, fields) => emit('warn', scope, message, fields),
    error: (message, fields) => emit('error', scope, message, fields),
  });

  const controls: Controls = {
    records: () => ring.toArray(),
    clear: () => ring.clear(),
    load: stored => ring.load(stored),
    addSink: sink => {
      sinks.add(sink);
      return () => sinks.delete(sink);
    },
    setLevel: level => {
      threshold = level;
    },
    getLevel: () => threshold,
  };

  return {
    ...(Object.fromEntries(SCOPES.map(scope => [scope, scoped(scope)])) as Record<Scope, ScopedLogger>),
    ...controls,
  };
}

/** The app's log. Call sites use this; tests build their own. */
export const log = createLog();

/**
 * The console sink, attached in development by `install.ts`.
 *
 * Not attached at creation, so a test does not print the records it asserts
 * on, and a release build does not format records nobody can read.
 */
export function consoleSink(record: LogRecord): void {
  const tag = `[${record.scope}]`;
  const detail = record.fields ? [record.fields] : [];
  if (record.level === 'error') console.error(tag, record.message, ...detail);
  else if (record.level === 'warn') console.warn(tag, record.message, ...detail);
  // `console.info`, not `console.log`: the architecture gate bans the latter
  // outright, and this is the one module with a reason to print at all.
  else console.info(tag, record.message, ...detail);
}
