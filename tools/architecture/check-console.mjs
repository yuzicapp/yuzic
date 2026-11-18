#!/usr/bin/env node
/**
 * Failure reports that go nowhere.
 *
 * Every `console.warn` and `console.error` in this app was a deliberate
 * report of something going wrong, and not one of them was reachable from a
 * device in a listener's hands. #325 is what that costs: `ErrorBoundary`
 * caught the crash, and passed the component stack naming its cause to
 * `console.error`. Three people reported it with screenshots, and the answer
 * had been on each of their phones.
 *
 * `features/diagnostics` is the replacement — `log.playback.warn('stream
 * stalled', { songId })` — and this gate is what stops the old habit growing
 * back while the 56 existing sites are migrated area by area. The allowlist
 * only shrinks, so a new one fails the build and a migrated one has to be
 * pruned out.
 *
 * Not a ban: `console.log` is that, over in the `unsafe` gate at zero. This
 * is a ratchet, and the number it holds is a to-do list.
 */
import { enforce } from './allowlist.mjs';
import { consoleCalls } from './detectors.mjs';

// Keyed per file and kind rather than per line, for the same reason as the
// provider and unsafe gates: line numbers turn an unrelated edit above a call
// into a new violation. A file clears once its last call of that kind is gone.
const keys = consoleCalls().map(call => `${call.kind} ${call.file}`);
process.exit(enforce('console', keys));
