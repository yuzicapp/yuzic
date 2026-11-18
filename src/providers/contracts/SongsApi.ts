import type { Song } from "@/domain/entities/Song";
import type { AudioQuality, PreferredCodec } from '@/domain/playback/AudioFormat';

export interface SongsApi {
  get(id: string): Promise<Song | null>;
  scrobble(songId: string, timestamp: number): Promise<void>;
  buildStreamUrl(songId: string, quality: AudioQuality, codec?: PreferredCodec): string;
  /**
   * What `scrobble()` amounts to on this server, which is the whole difference
   * between the two labels the Settings row can carry: Subsonic's scrobble.view
   * is a listen the server may forward onward to Last.fm/ListenBrainz, while
   * MediaBrowser's PlayedItems only moves a play count (its own scrobble plugin
   * reads the session events instead). Same call, two honest descriptions.
   */
  scrobbleKind: 'scrobble' | 'markPlayed';
  /**
   * The codecs this server will transcode a stream into, so a setting for one
   * is only offered where it does something. Subsonic's stream.view takes a
   * format but yuzic asks it for mp3 only, so Navidrome declares `['mp3']` and
   * the Opus switch stays off the Playback screen; MediaBrowser servers take an
   * `AudioCodec` and declare both. Callers read this rather than the server
   * type — a provider that gains Opus support declares it here and the switch
   * appears with no change to the screen.
   */
  streamableCodecs: readonly PreferredCodec[];
  /**
   * Whether `buildStreamUrl` does anything with the quality it is handed, so
   * the Wi-Fi and cellular quality rows are offered only where choosing one
   * changes what arrives.
   *
   * Distinct from `streamableCodecs`, which answers *which* codec: a server
   * can take a bitrate ceiling without offering a codec choice. Subsonic and
   * MediaBrowser both take one and declare `true`. Plex direct-plays the part
   * it is addressed by — the transcode endpoint is a different URL it does not
   * build — and a local file has no transcode at all, so both declare `false`
   * and their users stop being offered a data saver that streams the original
   * either way.
   */
  transcodes: boolean;
  /**
   * Whether this server reports the per-track loudness the engine needs to
   * level one track against the next, so the Player screen offers the setting
   * only where it would do something.
   *
   * Normalisation is the engine's to apply but nobody's to guess: with no
   * measured gain there is nothing to correct towards, and a switch that
   * silently does nothing is worse than an absent one. Subsonic's
   * OpenSubsonic tags carry ReplayGain per track and per album, so Navidrome
   * declares `true`. The others declare `false` until their measurement is
   * mapped — Jellyfin 10.10+ returns `LUFS`/`NormalizationGain` on audio
   * items and Plex exposes a per-part gain, so both are additions to a mapper
   * rather than absent server-side, and each flips this flag when it lands.
   */
  reportsLoudness: boolean;
  /**
   * Whether this server, as configured right now, actually returns a loudness
   * figure — asked of the server rather than inferred.
   *
   * `reportsLoudness` above says the protocol carries loudness and the mapper
   * reads it. That is not the same as a figure arriving: Jellyfin only
   * measures loudness from 10.10 onward, and only for a library it has
   * actually scanned, so a server can satisfy everything declared above and
   * still have nothing to level towards. A version check would answer the
   * wrong question — it would show the switch for a 10.10 server whose
   * library was never scanned.
   *
   * Absent means the declaration stands on its own, which is Navidrome's
   * case: ReplayGain tags come from the files and the server reports whatever
   * it was given.
   */
  probeLoudness?: () => Promise<boolean>;
  /**
   * "I am playing this right now", however the provider spells it: Subsonic's
   * scrobble.view with submission=false, a session-start event on
   * Jellyfin/Emby. Every provider that can express it implements this, so the
   * caller announces a track without knowing which server it is talking to.
   */
  reportNowPlaying?(songId: string): Promise<void>;
  /**
   * Session reporting. Optional — Navidrome forwards through scrobble() and
   * needs no pings. On Jellyfin/Emby these events *are* the scrobble (the
   * plugins fire on Stopped), so Stop is sent on every departure from a track
   * the adapter was told started, not only the ones that earned a scrobble;
   * `positionMs` is the playhead, not listened time; `isPaused` is live.
   */
  reportPlaybackProgress?(songId: string, positionMs: number, isPaused: boolean): Promise<void>;
  reportPlaybackStop?(songId: string, positionMs: number): Promise<void>;
}
