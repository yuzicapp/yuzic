import { buildTokenParams } from '@/providers/server/navidrome/client';
import { scrubText } from './scrub';

/**
 * The credential the app really issues, against the real builder.
 *
 * `scrub.test.ts` uses URLs written out by hand, which is the right way to
 * test the scrubbing itself but cannot notice the thing that would actually
 * break this: the client putting a credential somewhere the pattern does not
 * look. If Subsonic auth ever moves into the path, or a parameter outlives the
 * query, a hand-written fixture keeps passing while real logs start carrying
 * tokens. So this asks `buildTokenParams` for a live token and insists no part
 * of it survives.
 */
describe('scrubbing a credential this app actually generates', () => {
  const password = 'correct horse battery staple';
  const { u, t, s } = buildTokenParams('zack', password);
  const url = `https://music.example.com/rest/stream.view?u=${u}&t=${t}&s=${s}&v=1.16.1&c=yuzic&id=42`;

  it('issues a token derived from the password, so the URL is password-equivalent', () => {
    // Guards the premise, not the scrubber: if this stops holding, the
    // reasoning in `scrub.ts` about why a URL is a secret needs revisiting.
    expect(t).toMatch(/^[a-f0-9]{32}$/);
    expect(s.length).toBeGreaterThan(0);
  });

  it.each([
    ['the token', () => t],
    ['the salt', () => s],
    ['the username', () => u],
  ])('leaves no trace of %s', (_name, value) => {
    expect(scrubText(url)).not.toContain(value());
  });

  it('keeps the endpoint, which is what the log is for', () => {
    expect(scrubText(url)).toContain('/rest/stream.view');
  });

  it('survives the token appearing in engine-shaped prose', () => {
    const message = `Could not open Arrival: Error Domain=NSURLErrorDomain Code=-1013 UserInfo={NSErrorFailingURLStringKey=${url}}`;

    const out = scrubText(message);
    expect(out).toContain('Code=-1013');
    expect(out).not.toContain(t);
  });
});
