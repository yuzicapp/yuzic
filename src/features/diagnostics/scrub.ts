import type { Fields, LogRecord } from './record';

/**
 * Takes the credentials out of a record, at the moment it is captured.
 *
 * Every stream and artwork URL this app builds carries the user's credentials
 * in its query string: Subsonic sends `u` with `t` and `s`, where `t` is
 * md5(password + salt), or `p` with the password itself encoded; Jellyfin
 * sends `api_key`. So a URL in a log is a password-equivalent in a log.
 *
 * Three things then make that dangerous rather than theoretical. The engine
 * formats failures as prose — `emit(.failed("Could not open \(track.title):
 * \(error)"))` — and an NSError from a failed load carries the failing URL in
 * its userInfo, so the URL arrives already interpolated into a message. The
 * point of this log is an export the user attaches to a public issue. And the
 * issue template asks for logs, so they will.
 *
 * **Why at capture and not at export.** Scrubbing on the way out leaves the
 * credential in the ring buffer and in the persisted store, which is to say on
 * disk, where the next thing that reads a record — a crash reporter, a second
 * export path, a developer printing the buffer — leaks what this function was
 * written to prevent. Scrubbed on the way in, the credential never enters the
 * log at all, and no later reader has to remember this exists.
 *
 * **What is kept, and why.** The host and path survive: a failure's endpoint
 * (`/rest/stream.view`) is most of its diagnosis, and which base URL served it
 * is how a failover problem is recognised at all. Hosts are the user's own
 * server, which a bug report states anyway; credentials are not. Anything in
 * the query string is dropped wholesale rather than filtered by name, because
 * an allowlist of safe parameters is a list someone has to keep correct
 * forever, and a server with one more parameter is a leak. The count is kept
 * so a reader can see something was there.
 */

/** Query parameter names are not inspected — see above. Keys are, though. */
const SENSITIVE_KEY = /^(pass|password|secret|token|auth|authorization|apikey|api_key|credential|cookie|salt)$/i;

const REDACTED = '<redacted>';

/**
 * The most characters one field may carry.
 *
 * The ring is bounded by count, and that is only a bound on memory because a
 * record is small — see `ring.ts`. Most fields are an id or a number and stay
 * small on their own; a React component stack does not, and it is the single
 * most useful field this log captures. So it is kept, and cut: the top frames
 * name the component that failed, which is the part that explains a crash,
 * and the tail is the app shell every stack ends with.
 *
 * Cut here rather than at each call site, so no caller has to remember, and
 * so one place decides what "bounded" means.
 */
const MAX_FIELD_CHARS = 2000;

function bound(value: string): string {
  if (value.length <= MAX_FIELD_CHARS) return value;
  return `${value.slice(0, MAX_FIELD_CHARS)}… (+${value.length - MAX_FIELD_CHARS} more)`;
}

/**
 * Matches a URL inside a larger string, because that is how they arrive:
 * interpolated into a sentence by the engine, or into a thrown `Error`.
 * Deliberately stops at whitespace, quotes and brackets — the characters that
 * end a URL embedded in prose or in an NSError's description.
 */
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]}]+/gi;

/**
 * Rewrites one URL: drops any `user:pass@` and the whole query, keeps the rest.
 */
function scrubUrl(url: string): string {
  // Split the fragment off first so a `?` inside it is not read as a query.
  const [beforeFragment, ...fragmentParts] = url.split('#');
  const fragment = fragmentParts.length ? `#${REDACTED}` : '';

  const queryAt = beforeFragment.indexOf('?');
  const base = queryAt === -1 ? beforeFragment : beforeFragment.slice(0, queryAt);
  const query = queryAt === -1 ? '' : beforeFragment.slice(queryAt + 1);

  // `scheme://user:pass@host/path` — the credential is before the last `@` of
  // the authority, which ends at the first `/` after the scheme.
  const schemeEnd = base.indexOf('://') + 3;
  const authorityEnd = base.indexOf('/', schemeEnd);
  const authority = authorityEnd === -1 ? base.slice(schemeEnd) : base.slice(schemeEnd, authorityEnd);
  const path = authorityEnd === -1 ? '' : base.slice(authorityEnd);
  const host = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
  const userinfo = authority.includes('@') ? `${REDACTED}@` : '';

  const withoutQuery = `${base.slice(0, schemeEnd)}${userinfo}${host}${path}`;
  if (!query) return `${withoutQuery}${fragment}`;

  // How many were dropped, so a reader can tell a bare URL from a stripped one.
  const count = query.split('&').filter(Boolean).length;
  return `${withoutQuery}?${REDACTED}(${count})${fragment}`;
}

/** Replaces every URL inside a string, leaving the rest of the text intact. */
export function scrubText(text: string): string {
  return text.replace(URL_PATTERN, scrubUrl);
}

function scrubValue(key: string, value: Fields[string]): Fields[string] {
  if (SENSITIVE_KEY.test(key) && value !== null && value !== undefined && value !== '') {
    return REDACTED;
  }
  // Scrubbed before it is cut, never after: cutting first could leave half a
  // URL whose query the pattern no longer recognises, and so no longer strips.
  return typeof value === 'string' ? bound(scrubText(value)) : value;
}

function scrubFields(fields: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) out[key] = scrubValue(key, value);
  return out;
}

/**
 * The only way a record should reach a sink.
 *
 * Returns a new record; the caller's object is not touched, so a field object
 * the caller still holds is not quietly rewritten under it.
 */
export function scrub(record: LogRecord): LogRecord {
  return {
    ...record,
    message: bound(scrubText(record.message)),
    ...(record.fields ? { fields: scrubFields(record.fields) } : {}),
  };
}
