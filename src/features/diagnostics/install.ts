import { consoleSink, log } from './log';
import { createPersistence, type Persistence } from './store';

/**
 * Turns the app's log on, once, at startup.
 *
 * Separate from `log.ts` so the sinks can be attached without that module
 * importing the store that imports it. Nothing detaches these.
 *
 * The console sink is attached in development only. In a release build it
 * would format records nobody can read, which is the habit this feature
 * exists to replace.
 */
let persistence: Persistence | null = null;

export function installDiagnostics(): void {
  if (persistence) return;
  if (__DEV__) log.addSink(consoleSink);

  // Reads the previous session's records back first, so a crash that happened
  // moments ago is in the buffer by the time anything asks.
  persistence = createPersistence(log);
  persistence.install();

  log.app.info('app started');
}

/**
 * Writes the log out now, rather than on its debounce.
 *
 * For the fatal-error handler, which is about to restart the app: the records
 * explaining why are two seconds from being written and the process will not
 * last that long. MMKV is synchronous, so this returns before the restart.
 */
export function flushDiagnostics(): void {
  persistence?.flushNow();
}

/**
 * Forgets the log, in memory and on disk — the diagnostics screen's Clear.
 *
 * Offered because the export is the user's to send: a log holds what they
 * listened to and which of their endpoints failed, and someone who has just
 * shared it is entitled to take it back off the device.
 *
 * `log.clear()` runs unconditionally rather than through `persistence`, which
 * is null until `installDiagnostics` has run. Delegating the whole thing left
 * a control that reported success and deleted nothing if it was ever called
 * before install, or after an install that threw — the worst possible failure
 * for a button whose entire purpose is that the data is gone.
 */
export function clearDiagnostics(): void {
  log.clear();
  persistence?.clear();
}
