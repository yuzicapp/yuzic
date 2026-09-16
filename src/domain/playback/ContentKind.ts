/**
 * What kind of thing is playing.
 *
 * A regular song is the common case: known duration, scrobbleable, safe to
 * seek within, and a valid seed for autoplay. Radio, podcasts and previews
 * each break some of those assumptions, and the player has to know which
 * before it draws a progress bar or reports a listen.
 *
 * This is required on every playable entity rather than defaulted. A missing
 * `contentKind` used to mean "song", which meant a synthesised live stream or
 * a 30-second preview clip silently inherited song behaviour — scrobbled,
 * seeked, and used to seed autoplay — until someone noticed.
 */
export type ContentKind = 'song' | 'liveStream' | 'podcastEpisode' | 'preview';

/** What each kind supports. One table, so the rules cannot disagree per call site. */
interface ContentKindBehaviour {
  /** Has a known, finite duration a progress bar can be drawn against. */
  hasDuration: boolean;
  /** May be reported as a listen to a scrobble destination. */
  isScrobbleable: boolean;
  /** The user may seek within it. */
  isSeekable: boolean;
  /** May be used as a seed for autoplay/queue filling. */
  isAutoplaySeed: boolean;
  /**
   * The origin can issue a fresh URL for it on demand.
   *
   * True for anything the user's own server streams: the URL is credentialled,
   * goes stale with the session, and is rebuilt from the track's id every time
   * it is played. False where the URL the app holds IS the only URL there is —
   * an internet radio station's endpoint belongs to the station, and a sample
   * link is issued once — in which case it is used exactly as stored.
   */
  hasReissuableUrl: boolean;
  /**
   * A broadcast with no end, which the player has to be told about.
   *
   * Not the same question as `hasDuration`, though today only one kind answers
   * both: this one changes how the audio is *fetched*. The engine reads a
   * continuous track with a stream parser instead of a file parser, and a
   * file parser waits for the end of a station that never ends — so a station
   * the engine was not told about never started playing.
   */
  isContinuous: boolean;
}

const BEHAVIOUR: Record<ContentKind, ContentKindBehaviour> = {
  song: {
    hasDuration: true,
    isScrobbleable: true,
    isSeekable: true,
    isAutoplaySeed: true,
    hasReissuableUrl: true,
    isContinuous: false,
  },
  liveStream: {
    hasDuration: false,
    isScrobbleable: false,
    isSeekable: false,
    isAutoplaySeed: false,
    isContinuous: true,
    // The station owns its endpoint, not the user's server. Asking the server
    // to build a stream URL for a radio station produces a URL for a track
    // that does not exist there, which is silent, total breakage of radio.
    hasReissuableUrl: false,
  },
  podcastEpisode: {
    hasDuration: true,
    // A finished episode is a listen the same way a finished track is, and the
    // player has always scrobbled them. This table said otherwise while
    // nothing read it — a second rule beside the one that ran — until the
    // player's own gates were folded into it.
    isScrobbleable: true,
    isSeekable: true,
    isAutoplaySeed: false,
    // The server downloaded the episode and streams it, under an id of its own
    // that `Song.streamId` carries.
    hasReissuableUrl: true,
    isContinuous: false,
  },
  // A short sample an integration supplies in place of the full recording —
  // typically thirty seconds. Any provider that hands back a sample rather
  // than the work gets these semantics by declaring this kind, with no new
  // branch anywhere and no provider named here. Finite, but not a listen and
  // not a seed, and its URL is issued once and cannot be asked for again.
  preview: {
    hasDuration: true,
    isScrobbleable: false,
    isSeekable: true,
    isAutoplaySeed: false,
    hasReissuableUrl: false,
    isContinuous: false,
  },
};

export const contentKindBehaviour = (kind: ContentKind): ContentKindBehaviour => BEHAVIOUR[kind];

export const hasDuration = (kind: ContentKind): boolean => BEHAVIOUR[kind].hasDuration;
export const isScrobbleable = (kind: ContentKind): boolean => BEHAVIOUR[kind].isScrobbleable;
export const isSeekable = (kind: ContentKind): boolean => BEHAVIOUR[kind].isSeekable;
export const isAutoplaySeed = (kind: ContentKind): boolean => BEHAVIOUR[kind].isAutoplaySeed;
export const hasReissuableUrl = (kind: ContentKind): boolean => BEHAVIOUR[kind].hasReissuableUrl;
export const isContinuous = (kind: ContentKind): boolean => BEHAVIOUR[kind].isContinuous;
