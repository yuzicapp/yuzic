/**
 * What one log entry is.
 *
 * Fields, not prose. The app's failure reports were `console.warn('Playback
 * failed', info)` and `console.error('[ErrorBoundary]', error, stack)`: both
 * assembled the right information and then flattened it into arguments nobody
 * could read, filter or redact. A record keeps the parts apart, so a reader
 * can select by scope and level, redaction can find the fields that carry
 * credentials, and an export can be machine-readable.
 *
 * `message` is a short, fixed string — "stream failed", not "stream failed for
 * Arrival (id 42) from https://...". Anything that varies belongs in `fields`,
 * where it can be scrubbed. A varying message is also unsearchable: two
 * reports of the same failure never share a line.
 */
export const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type Level = (typeof LEVELS)[number];

/** Rank, for threshold comparisons. `debug` is 0. */
export const levelRank = (level: Level): number => LEVELS.indexOf(level);

/**
 * The parts of the app a record can come from.
 *
 * A closed set rather than a free string: a scope is what a reader filters by
 * and what the console sink prints as a tag, and free strings drift into
 * `player`, `playback` and `Player` meaning the same thing. Added to
 * deliberately, and named for the area, not the file.
 */
export const SCOPES = [
  'playback',
  'player',
  'server',
  'integration',
  'library',
  'offline',
  'downloads',
  'sources',
  'crash',
  'app',
] as const;

export type Scope = (typeof SCOPES)[number];

/**
 * Structured detail. Values stay primitive: a record is serialised to the
 * store and to the export, and an object graph in a log field is how a log
 * ends up retaining a component tree or a whole queue.
 */
export type Fields = Record<string, string | number | boolean | null | undefined>;

export interface LogRecord {
  /** Epoch milliseconds, so ordering survives serialisation. */
  at: number;
  level: Level;
  scope: Scope;
  /** Fixed and short — see the note above on why it does not interpolate. */
  message: string;
  fields?: Fields;
}
