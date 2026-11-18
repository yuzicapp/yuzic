import { consoleSink, log } from './log';
import { createPersistence } from './store';

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
export function installDiagnostics(): void {
  if (__DEV__) log.addSink(consoleSink);

  // Reads the previous session's records back first, so a crash that happened
  // moments ago is in the buffer by the time anything asks.
  createPersistence(log).install();

  log.app.info('app started');
}
