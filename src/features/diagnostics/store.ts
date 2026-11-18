import { logStorage } from '@/state/mmkvStorage';
import type { Log } from './log';
import { LEVELS, type Level, type LogRecord, type Scope, SCOPES } from './record';

/**
 * Keeping a log across a restart.
 *
 * Only because of crashes. An in-memory buffer answers "why did that track
 * fail", because the app is still running to be asked — but the reports this
 * exists for include the ones where the app died, and #325 is the shape of it:
 * a caught crash, a full-screen error, and a user who restarts before anything
 * can be exported. The record naming the cause has to outlive the process that
 * wrote it.
 *
 * **Written whole, on a debounce, rather than per record.** One key holding
 * the buffer costs a serialise of the whole thing per write — wrong per
 * record, fine per burst. The engine measured a failing stream at 121 failures
 * a minute, so a write each would be 121 serialisations of 400 records;
 * debounced, that burst is a handful. The alternative, a key per record with a
 * head pointer, makes each write O(1) but leaves the store to be compacted and
 * the order rebuilt on read, which is more machinery than the volume earns.
 *
 * MMKV's `set` is synchronous and memory-mapped, so a flush is not an I/O wait
 * and `flushNow` is safe from a fatal handler that is about to restart the app.
 *
 * Takes its log and its storage rather than reaching for them, so a test drives
 * a real one of each without resetting shared state between cases.
 */

const KEY = 'records';

/** Long enough to coalesce a failure burst, short enough to survive a crash. */
export const FLUSH_DEBOUNCE_MS = 2000;

/** The slice of MMKV this needs — named so a test can pass its own. */
type LogStore = Pick<typeof logStorage, 'set' | 'getString' | 'clearAll'>;

export interface Persistence {
  /** Reads the previous session's records back into the log. */
  restore: () => void;
  /** Writes now. Called on the debounce, and directly before a restart. */
  flushNow: () => void;
  /** Forgets everything, on disk as well as in memory. */
  clear: () => void;
  /** Restores, then keeps the store in step. Returns the detach. */
  install: () => () => void;
}

/**
 * Whether a parsed value is a record this app wrote.
 *
 * The store outlives an app upgrade, so what comes back is whatever the
 * *previous* version wrote — a scope that no longer exists, a shape from
 * before a field was added. Checked rather than cast: a bad entry would
 * otherwise reach the export and the diagnostics list as a record with no
 * level, and the screen built to explain crashes would be the one crashing.
 */
function isRecord(value: unknown): value is LogRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LogRecord>;
  return (
    typeof candidate.at === 'number' &&
    typeof candidate.message === 'string' &&
    LEVELS.includes(candidate.level as Level) &&
    SCOPES.includes(candidate.scope as Scope)
  );
}

export function createPersistence(target: Log, storage: LogStore = logStorage): Persistence {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const flushNow = (): void => {
    cancel();
    try {
      storage.set(KEY, JSON.stringify(target.records()));
    } catch {
      // A log that cannot be written must not break the app that was logging.
    }
  };

  const restore = (): void => {
    try {
      const raw = storage.getString(KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      target.load(parsed.filter(isRecord));
    } catch {
      // Unparseable: start empty rather than refuse to launch.
    }
  };

  return {
    restore,
    flushNow,
    clear: () => {
      cancel();
      target.clear();
      try {
        storage.clearAll();
      } catch {
        // Nothing to do about it, and nowhere useful to say so.
      }
    },
    install: () => {
      restore();
      return target.addSink(() => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          flushNow();
        }, FLUSH_DEBOUNCE_MS);
      });
    },
  };
}
