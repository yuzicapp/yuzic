import { Alert } from 'react-native';
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler';
import RNRestart from 'react-native-restart';

import i18n from '@/i18n';
import { flushDiagnostics } from './install';
import { log } from './log';

/**
 * The last two things that happen before the app stops being able to tell you
 * anything.
 *
 * Lifted out of the root layout, which had them inline: a layout file should
 * say what the app renders, not hold crash policy, and inline they could not
 * be tested. They are also what pushed that file past its line limit, which
 * was the gate pointing at the same thing.
 *
 * **Both handlers write the log immediately.** A record sitting in the ring is
 * two seconds from being persisted, and neither of these paths has two
 * seconds: the JS one shows an Alert the user may answer by force-quitting,
 * and the native one is running inside a process that is already going down.
 * MMKV is synchronous and memory-mapped, so the flush completes before either
 * returns.
 *
 * **The non-fatal JS errors are recorded as well.** They reach no Alert and
 * the app carries on — which is precisely the failure a user reports as "it
 * went weird for a moment" with nothing to show for it.
 */
export function installFatalHandlers(): void {
  setJSExceptionHandler((error, isFatal) => {
    log.crash.error(isFatal ? 'fatal js error' : 'js error', {
      name: error.name,
      detail: error.message,
      fatal: isFatal,
    });
    flushDiagnostics();

    if (!isFatal) return;

    Alert.alert(
      i18n.t('common.error.unexpected'),
      i18n.t('common.error.details', { name: error.name, message: error.message }),
      [{ text: i18n.t('common.error.restart'), onPress: () => RNRestart.Restart() }]
    );
  }, true);

  // Record and write, and nothing else: this one runs on borrowed time. It was
  // a no-op, which is why a native crash has never left anything to report.
  setNativeExceptionHandler(
    exceptionString => {
      log.crash.error('native crash', { detail: exceptionString });
      flushDiagnostics();
    },
    false,
    true
  );
}
