import { Alert } from 'react-native';
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler';

import { installFatalHandlers } from './fatalHandlers';
import { flushDiagnostics } from './install';
import { log } from './log';

jest.mock('react-native-exception-handler', () => ({
  setJSExceptionHandler: jest.fn(),
  setNativeExceptionHandler: jest.fn(),
}));
jest.mock('react-native-restart', () => ({ __esModule: true, default: { Restart: jest.fn() } }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('./install', () => ({ flushDiagnostics: jest.fn() }));

/** The handlers the module registered, so the test can fire them. */
const registeredJsHandler = (): ((error: Error, isFatal: boolean) => void) =>
  jest.mocked(setJSExceptionHandler).mock.calls[0][0] as never;

const registeredNativeHandler = (): ((exceptionString: string) => void) =>
  jest.mocked(setNativeExceptionHandler).mock.calls[0][0] as never;

describe('installFatalHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    log.clear();
    log.setLevel('debug');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    installFatalHandlers();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('a fatal JS error', () => {
    it('is recorded before anything else happens', () => {
      registeredJsHandler()(new TypeError('undefined is not a function'), true);

      expect(log.records()).toEqual([
        expect.objectContaining({
          scope: 'crash',
          message: 'fatal js error',
          fields: expect.objectContaining({
            name: 'TypeError',
            detail: 'undefined is not a function',
            fatal: true,
          }),
        }),
      ]);
    });

    /**
     * The user may answer the Alert by force-quitting rather than by pressing
     * Restart, and the record explaining the crash is otherwise still two
     * seconds from being written. So the flush cannot wait for `onPress`.
     */
    it('is written to disk immediately, not left on the debounce', () => {
      registeredJsHandler()(new Error('boom'), true);

      expect(flushDiagnostics).toHaveBeenCalled();
    });

    it('still shows the user the alert', () => {
      registeredJsHandler()(new Error('boom'), true);

      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('a non-fatal JS error', () => {
    it('is recorded too — this is the "it went weird" report', () => {
      registeredJsHandler()(new Error('odd but survivable'), false);

      expect(log.records()).toEqual([
        expect.objectContaining({
          message: 'js error',
          fields: expect.objectContaining({ fatal: false }),
        }),
      ]);
    });

    it('does not interrupt the user with an alert', () => {
      registeredJsHandler()(new Error('odd but survivable'), false);

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('a native crash', () => {
    it('is recorded and written, since the process is going down', () => {
      registeredNativeHandler()('SIGSEGV in AudioFileReader');

      expect(log.records()).toEqual([
        expect.objectContaining({
          scope: 'crash',
          message: 'native crash',
          fields: expect.objectContaining({ detail: 'SIGSEGV in AudioFileReader' }),
        }),
      ]);
      expect(flushDiagnostics).toHaveBeenCalled();
    });
  });

  it('keeps credentials out of a crash record', () => {
    registeredNativeHandler()(
      'failed loading https://music.example.com/rest/stream.view?u=zack&t=26719a1196d2a940705a59634eb18eab'
    );

    expect(JSON.stringify(log.records())).not.toContain('26719a1196d2a940705a59634eb18eab');
  });
});
