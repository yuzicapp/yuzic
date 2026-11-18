import { scrub, scrubText } from './scrub';
import type { LogRecord } from './record';

const record = (over: Partial<LogRecord> = {}): LogRecord => ({
  at: 0,
  level: 'error',
  scope: 'server',
  message: 'stream failed',
  ...over,
});

/**
 * The URLs this app actually builds, written out rather than referenced: a
 * test that asks the client to build one would pass just as happily if the
 * client stopped sending credentials, which is the thing being guarded.
 */
const SUBSONIC_TOKEN = 'https://music.example.com/rest/stream.view?u=zack&t=26719a1196d2a940705a59634eb18eab&s=c19b2d&v=1.16.1&c=yuzic&id=42&format=mp3';
const SUBSONIC_PASSWORD = 'https://music.example.com/rest/stream.view?u=zack&p=enc:7a6b5c4d3e&v=1.16.1&c=yuzic&id=42';
const JELLYFIN = 'https://jf.example.com/Audio/abc123/universal?api_key=8f14e45fceea167a5a36dedd4bea2543&UserId=99';

describe('scrubText', () => {
  it('drops a Subsonic token and salt, keeping the endpoint', () => {
    const out = scrubText(SUBSONIC_TOKEN);

    expect(out).toContain('https://music.example.com/rest/stream.view');
    expect(out).not.toContain('26719a1196d2a940705a59634eb18eab');
    expect(out).not.toContain('c19b2d');
    expect(out).not.toContain('zack');
  });

  it('drops an encoded Subsonic password', () => {
    expect(scrubText(SUBSONIC_PASSWORD)).not.toContain('enc:7a6b5c4d3e');
  });

  it('drops a Jellyfin api_key', () => {
    const out = scrubText(JELLYFIN);

    expect(out).toContain('https://jf.example.com/Audio/abc123/universal');
    expect(out).not.toContain('8f14e45fceea167a5a36dedd4bea2543');
  });

  it('says how many parameters were dropped', () => {
    expect(scrubText(JELLYFIN)).toContain('<redacted>(2)');
  });

  it('leaves a URL with no query alone', () => {
    const plain = 'https://music.example.com/rest/ping.view';
    expect(scrubText(plain)).toBe(plain);
  });

  /**
   * The shape the engine produces: prose with the URL interpolated into it by
   * `emit(.failed("Could not open \(title): \(error)"))`, where the error is
   * an NSError carrying the failing URL.
   */
  it('scrubs a URL embedded in a sentence, keeping the sentence', () => {
    const out = scrubText(
      `Could not open Arrival: Error Domain=NSURLErrorDomain Code=-1008 "resource unavailable" UserInfo={NSErrorFailingURLStringKey=${SUBSONIC_TOKEN}}`
    );

    expect(out).toContain('Could not open Arrival');
    expect(out).toContain('Code=-1008');
    expect(out).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  it('scrubs every URL when a message carries more than one', () => {
    const out = scrubText(`failed over from ${SUBSONIC_TOKEN} to ${JELLYFIN}`);

    expect(out).not.toContain('26719a1196d2a940705a59634eb18eab');
    expect(out).not.toContain('8f14e45fceea167a5a36dedd4bea2543');
  });

  it('drops user:password@ from an authority', () => {
    const out = scrubText('http://zack:hunter2@music.example.com/rest/ping.view');

    expect(out).not.toContain('hunter2');
    expect(out).toContain('music.example.com');
  });

  it('redacts a fragment, which can carry a token of its own', () => {
    expect(scrubText('https://example.com/cb#access_token=abc123')).not.toContain('abc123');
  });

  it('keeps a file URL usable — a download path is not a credential', () => {
    const file = 'file:///var/mobile/Containers/Data/Application/X/Documents/42.mp3';
    expect(scrubText(file)).toBe(file);
  });

  it('leaves text with no URL in it untouched', () => {
    expect(scrubText('several tracks in a row would not play')).toBe(
      'several tracks in a row would not play'
    );
  });
});

describe('bounding a large field', () => {
  it('keeps a component stack but cuts it, saying how much went', () => {
    const stack = 'at PlayingScreen\n'.repeat(500);

    const out = scrub(record({ fields: { componentStack: stack } }));
    const kept = String(out.fields?.componentStack);

    expect(kept.length).toBeLessThan(stack.length);
    expect(kept).toContain('at PlayingScreen');
    expect(kept).toMatch(/\(\+\d+ more\)$/);
  });

  it('keeps the top of the stack, which is the part that names the failure', () => {
    const stack = `at TheComponentThatFailed\n${'at Filler\n'.repeat(500)}`;

    expect(String(scrub(record({ fields: { componentStack: stack } })).fields?.componentStack))
      .toContain('at TheComponentThatFailed');
  });

  it('leaves a field that is already small exactly as it was', () => {
    const out = scrub(record({ fields: { componentStack: 'at PlayingScreen' } }));
    expect(out.fields?.componentStack).toBe('at PlayingScreen');
  });

  it('cuts a long message too', () => {
    const out = scrub(record({ message: 'x'.repeat(5000) }));
    expect(out.message.length).toBeLessThan(5000);
  });

  /**
   * Order matters: cut first and a URL can lose the `?` that makes its query
   * recognisable, so the credential in the tail would survive the scrubbing.
   */
  it('scrubs before cutting, so a credential cannot survive in the tail', () => {
    const padding = 'y'.repeat(1990);
    const out = scrub(record({ fields: { note: `${padding} ${SUBSONIC_TOKEN}` } }));

    expect(String(out.fields?.note)).not.toContain('26719a1196d2a940705a59634eb18eab');
  });
});

describe('scrub', () => {
  it('scrubs the message', () => {
    const out = scrub(record({ message: `could not open ${SUBSONIC_TOKEN}` }));
    expect(out.message).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  it('scrubs a URL held in a field', () => {
    const out = scrub(record({ fields: { url: SUBSONIC_TOKEN } }));
    expect(out.fields?.url).not.toContain('26719a1196d2a940705a59634eb18eab');
  });

  it.each(['password', 'token', 'Authorization', 'api_key', 'secret', 'salt', 'cookie'])(
    'redacts a field named %s whatever its shape',
    key => {
      const out = scrub(record({ fields: { [key]: 'not-a-url-but-still-secret' } }));
      expect(out.fields?.[key]).toBe('<redacted>');
    }
  );

  it('keeps the diagnostic fields that are the point of the log', () => {
    const out = scrub(
      record({ fields: { code: 'PLAYBACK_FAILED', songId: '42', position: 57.2, offline: false } })
    );

    expect(out.fields).toEqual({
      code: 'PLAYBACK_FAILED',
      songId: '42',
      position: 57.2,
      offline: false,
    });
  });

  it('does not rewrite the caller’s own object', () => {
    const fields = { url: SUBSONIC_TOKEN };
    scrub(record({ fields }));
    expect(fields.url).toBe(SUBSONIC_TOKEN);
  });

  it('leaves a record with no fields without a fields key', () => {
    expect(scrub(record())).not.toHaveProperty('fields');
  });

  it('passes null and undefined through rather than redacting them', () => {
    const out = scrub(record({ fields: { token: null, password: undefined, code: null } }));

    expect(out.fields?.token).toBeNull();
    expect(out.fields?.password).toBeUndefined();
  });
});
