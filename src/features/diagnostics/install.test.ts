import { clearDiagnostics } from './install';
import { log } from './log';

describe('clearDiagnostics', () => {
  /**
   * The screen's Clear button is a promise that the data is gone. This used
   * to delegate the whole job to the persistence instance, which is null
   * until `installDiagnostics` has run — so called before install, or after
   * an install that threw, it reported success and deleted nothing. For a
   * control whose only purpose is deletion, that is the worst way to fail.
   */
  it('empties the log even when persistence was never installed', () => {
    log.setLevel('debug');
    log.app.info('something the user wants gone');
    expect(log.records()).toHaveLength(1);

    clearDiagnostics();

    expect(log.records()).toEqual([]);
  });
});
