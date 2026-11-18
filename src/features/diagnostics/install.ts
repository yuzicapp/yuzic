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
