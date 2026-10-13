import type { AudioQuality, PreferredCodec } from '@/domain/playback/AudioFormat';
import { qualityToStreamParams } from '@/providers/server/streamQuality';
import { tryWithFailover, orderedUrls, UrlTimeoutError, isAbortError } from '@/providers/http/urlFailover';
import { serverFetch } from '@/features/mtls/serverFetch';
import { ServerFeatureUnavailableError } from '@/providers/contracts/ServerAdapter';

// md5 does not ship TypeScript declarations in this project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const md5 = require("md5") as (s: string) => string;

/** How long one URL gets to answer before failover moves on to the next. */
const REQUEST_TIMEOUT_MS = 30_000;

interface NavidromeClientConfig {
  /** Primary server URL. Used verbatim when no serverId/fallbackUrls given. */
  serverUrl: string;
  /** Server identity, needed to cache the last-known-good URL across requests. */
  serverId?: string;
  /** Extra URLs the failover layer tries after `serverUrl` (issue #115). */
  fallbackUrls?: string[];
  username: string;
  password: string;
  defaultParams?: Record<string, string | number>;
  basicAuth?: { username: string; password?: string };
}

const API_VERSION = "1.16.0";
const CLIENT_NAME = "Yuzic";

export type NavidromeClient = ReturnType<typeof createNavidromeClient>;

/** A request the server answered and refused — `status: "failed"` in a 200 body. */
export class SubsonicRequestError extends Error {
  constructor(readonly code: number | undefined, message: string | undefined) {
    super(message ?? `Subsonic request failed${code !== undefined ? ` (${code})` : ''}`);
    this.name = 'SubsonicRequestError';
  }
}

function randomSalt(): string {
  return Math.random().toString(36).slice(2, 14);
}

export function buildTokenParams(username: string, password: string): {
  u: string;
  t: string;
  s: string;
} {
  const salt = randomSalt();
  const token = md5(password + salt);
  return { u: username, t: token, s: salt };
}

/**
 * The password as Subsonic's `enc:` form — its UTF-8 bytes in hex. Not
 * secrecy (hex is not encryption), only what the spec defines for `p`, and it
 * keeps a password with `&` or `%` in it from reading as more parameters.
 */
function encodedPassword(password: string): string {
  const hex = encodeURIComponent(password).replace(/%([0-9A-F]{2})|([^%])/g, (_match, byte, char) =>
    byte ? byte.toLowerCase() : char.charCodeAt(0).toString(16).padStart(2, '0')
  );
  return `enc:${hex}`;
}

/**
 * Subsonic's "token authentication not supported" (41) and OpenSubsonic's
 * "authentication mechanism not supported" (42). Nextcloud Music answers 41:
 * it keeps only a hash of the app password, so it has nothing to check a
 * salted token against, and takes the password itself instead (#271).
 */
const TOKEN_AUTH_REFUSED = new Set([41, 42]);

/** A query value; an array repeats the key, which is how Subsonic takes a list. */
type ParamValue = string | number | readonly (string | number)[];

function buildParams(
  auth: Record<string, string>,
  extra: Record<string, ParamValue> = {},
  opts?: { format?: "json" | null }
): string {
  const params = new URLSearchParams({
    ...auth,
    v: API_VERSION,
    c: CLIENT_NAME,
    ...(opts?.format === null ? {} : { f: "json" }),
  });
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value)) value.forEach(item => params.append(key, String(item)));
    else params.set(key, String(value));
  }
  return params.toString();
}

export function createNavidromeClient(config: NavidromeClientConfig) {
  const { serverUrl, serverId, fallbackUrls, username, password, defaultParams, basicAuth } = config;
  const baseUrl = serverUrl.replace(/\/+$/, "");
  const failoverHint = serverId
    ? { id: serverId, serverUrl: baseUrl, fallbackUrls }
    : null;
  const proxyHeader: Record<string, string> = basicAuth
    ? { Authorization: 'Basic ' + btoa(`${basicAuth.username}:${basicAuth.password ?? ''}`) }
    : {};

  let extensions: Promise<Set<string>> | null = null;
  // Token auth until the server says it cannot take it, then the password for
  // the rest of this client's life — one refused request, not one per request.
  let passwordAuth = false;
  const authParams = (): Record<string, string> =>
    passwordAuth ? { u: username, p: encodedPassword(password) } : buildTokenParams(username, password);

  /**
   * The OpenSubsonic extensions the server declares, asked once per client.
   * A server that predates them, or fails to answer, has none — the request
   * then goes the plain Subsonic way, which every server accepts.
   */
  function openSubsonicExtensions(): Promise<Set<string>> {
    extensions ??= request<{ "subsonic-response"?: { openSubsonicExtensions?: { name?: string }[] } }>(
      "getOpenSubsonicExtensions.view"
    )
      .then(body => new Set((body["subsonic-response"]?.openSubsonicExtensions ?? []).map(ext => ext.name ?? "")))
      .catch(() => new Set<string>());
    return extensions;
  }

  async function request<T>(
    endpoint: string,
    extraParams: Record<string, ParamValue> = {},
    options: { method?: "GET" | "POST" } = {}
  ): Promise<T> {
    try {
      return await send<T>(endpoint, extraParams, options);
    } catch (error) {
      if (passwordAuth || !(error instanceof SubsonicRequestError) || !TOKEN_AUTH_REFUSED.has(error.code ?? -1)) {
        throw error;
      }
      passwordAuth = true;
      return send<T>(endpoint, extraParams, options);
    }
  }

  async function send<T>(
    endpoint: string,
    extraParams: Record<string, ParamValue>,
    options: { method?: "GET" | "POST" }
  ): Promise<T> {
    const auth = authParams();
    const params = buildParams(auth, { ...(defaultParams ?? {}), ...extraParams });
    // A POST carries its parameters in the body where the server says it can
    // take them there. In the URL, a playlist rewrite repeats a song id per
    // track, and a long one outgrows the URL limit of a reverse proxy in front.
    const asForm = options.method === "POST" && (await openSubsonicExtensions()).has("formPost");
    const attempt = async (url: string): Promise<T> => {
      const controller = new AbortController();
      // Whether *we* aborted. A bare AbortError cannot be told apart from a
      // cancellation, and failover has to know: a timed-out URL is one to give
      // up on and move past, a cancelled request is not. Reported as a
      // `UrlTimeoutError` so `isNetworkError` can say so without having to
      // treat every abort as a dead URL — see #263.
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      try {
        const res = await serverFetch(asForm ? `${url}/rest/${endpoint}` : `${url}/rest/${endpoint}?${params}`, {
          method: options.method ?? "GET",
          headers: asForm ? { ...proxyHeader, "Content-Type": "application/x-www-form-urlencoded" } : proxyHeader,
          body: asForm ? params : undefined,
          signal: controller.signal,
        });
        // 501 is Navidrome's answer for an endpoint it has not implemented
        // (podcasts) or has switched off in its config (sharing): not a
        // failure to retry, but a feature this server does not have.
        if (res.status === 501) {
          throw new ServerFeatureUnavailableError(await res.text());
        }
        if (!res.ok) {
          throw new Error(`Navidrome API error (${res.status}): ${await res.text()}`);
        }
        const body = await res.json();
        // Subsonic refuses with 200 OK and says so in the body. Returned as-is,
        // a refusal read as a response with nothing in it — a library that was
        // empty rather than a request that failed (see client.test.ts).
        const envelope = body?.["subsonic-response"];
        if (envelope?.status === "failed") {
          throw new SubsonicRequestError(envelope.error?.code, envelope.error?.message);
        }
        return body as T;
      } catch (error) {
        // Both halves matter. `timedOut` alone would relabel a real Subsonic
        // refusal that happened to be thrown while parsing a body the timer
        // then fired under; the abort alone cannot say the deadline caused it.
        throw timedOut && isAbortError(error)
          ? new UrlTimeoutError(url, REQUEST_TIMEOUT_MS)
          : error;
      } finally {
        clearTimeout(timer);
      }
    };
    return failoverHint ? tryWithFailover(failoverHint, attempt) : attempt(baseUrl);
  }

  function buildStreamUrl(
    songId: string,
    quality: AudioQuality = 'high',
    codec: PreferredCodec = 'mp3',
  ): string {
    // Streams pick up whichever URL failover has most recently confirmed alive:
    // after a metadata request falls over to the fallback, the next stream URL
    // is built against that same address.
    const streamBaseUrl = failoverHint ? orderedUrls(failoverHint)[0] ?? baseUrl : baseUrl;
    const { format, maxBitRate } = qualityToStreamParams(quality, codec);
    const auth = authParams();
    const extra: Record<string, string | number> = { id: songId, format };
    if (maxBitRate) extra.maxBitRate = maxBitRate;
    const params = buildParams(auth, extra, { format: null });
    return `${streamBaseUrl}/rest/stream.view?${params}`;
  }

  function buildAvatarUrl(): string {
    // Same failover treatment as a stream: the avatar is fetched by the image
    // loader against whichever URL was last confirmed alive.
    const base = failoverHint ? orderedUrls(failoverHint)[0] ?? baseUrl : baseUrl;
    const auth = authParams();
    // `f=json` is deliberately omitted — the response is a PNG, and asking for
    // JSON makes Navidrome answer with an error document instead of an image.
    const params = buildParams(auth, { username }, { format: null });
    return `${base}/rest/getAvatar.view?${params}`;
  }

  return {
    request,
    buildStreamUrl,
    buildAvatarUrl,
    serverUrl: baseUrl,
    /** Server identity used to build a stable `LocalId` for entities this client fetches. */
    serverId,
    username,
    password,
  };
}
