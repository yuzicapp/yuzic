import type { Server } from '@/providers/contracts/Server';
import { createNavidromeAdapter } from './navidrome';
import { createJellyfinAdapter } from './media-browser/jellyfin';
import { createEmbyAdapter } from './media-browser/emby';
import { createPlexAdapter } from './plex';
import { createLocalAdapter } from './local';

function serverOf(type: Server['type']): Server {
  return {
    id: `${type}-1`,
    type,
    serverUrl: 'https://media.example',
    username: 'ari',
    auth: type === 'navidrome' ? { password: 'pw' } : { token: 'tok', userId: 'u1' },
    isAuthenticated: true,
  };
}

const adapters = {
  navidrome: () => createNavidromeAdapter(serverOf('navidrome')),
  jellyfin: () => createJellyfinAdapter(serverOf('jellyfin')),
  emby: () => createEmbyAdapter(serverOf('emby')),
  plex: () => createPlexAdapter(serverOf('plex')),
  local: () => createLocalAdapter(serverOf('local')),
};

/**
 * Settings screens read these to decide what to show. They used to ask what
 * kind of server was connected instead, which meant every new provider needed
 * an edit in each screen that cared — and meant a screen could offer a switch
 * for something the server couldn't do. Each adapter states its own answer
 * here; the screens only read.
 */
describe('adapter capability declarations', () => {
  it('says which codecs it can stream, so Playback offers Opus only where it works', () => {
    // Navidrome ships an Opus transcoding profile and downsamples to Opus by
    // default; it declared MP3 only, so the switch never appeared and every
    // transcode was asked for in MP3 regardless.
    expect(adapters.navidrome().songs.streamableCodecs).toContain('opus');
    expect(adapters.jellyfin().songs.streamableCodecs).toContain('opus');
    expect(adapters.emby().songs.streamableCodecs).toContain('opus');
    // Plex direct-plays its part URI; it does not expose a codec choice.
    expect(adapters.plex().songs.streamableCodecs).toEqual([]);
    expect(adapters.local().songs.streamableCodecs).toEqual([]);
  });

  it('says what scrobbling amounts to, so the Server row is worded honestly', () => {
    // scrobble.view is a listen the server may forward onward.
    expect(adapters.navidrome().songs.scrobbleKind).toBe('scrobble');
    // PlayedItems only moves a play count.
    expect(adapters.jellyfin().songs.scrobbleKind).toBe('markPlayed');
    expect(adapters.emby().songs.scrobbleKind).toBe('markPlayed');
    expect(adapters.plex().songs.scrobbleKind).toBe('scrobble');
    expect(adapters.local().songs.scrobbleKind).toBe('scrobble');
  });

  it('announces now-playing where the provider has a remote session to update', () => {
    for (const make of [adapters.navidrome, adapters.jellyfin, adapters.emby, adapters.plex]) {
      expect(make().songs.reportNowPlaying).toBeDefined();
    }
    expect(adapters.local().songs.reportNowPlaying).toBeUndefined();
  });

  it('offers a streaming-quality choice only where the server acts on one', () => {
    // Both take a bitrate ceiling on the stream request.
    expect(adapters.navidrome().songs.transcodes).toBe(true);
    expect(adapters.jellyfin().songs.transcodes).toBe(true);
    expect(adapters.emby().songs.transcodes).toBe(true);

    // Plex's buildStreamUrl is handed a quality and drops it: it addresses the
    // part directly and direct-plays it, so every track arrived at original
    // quality while the Wi-Fi and cellular rows implied otherwise. Its
    // transcode endpoint is a different URL, and this flips when that lands.
    expect(adapters.plex().songs.transcodes).toBe(false);

    // A local file is already on the device; there is nothing to transcode.
    expect(adapters.local().songs.transcodes).toBe(false);
  });

  it('offers loudness normalisation only where the server measures it', () => {
    // OpenSubsonic's ReplayGain tags are per track and per album, and the
    // mapper reads them, so the engine has a gain to level towards.
    expect(adapters.navidrome().songs.reportsLoudness).toBe(true);

    // Jellyfin measures loudness itself and returns `NormalizationGain` per
    // track — unrequested, verified against a 12.4 server — and `mapSong`
    // now reads it, so the switch has a figure to level towards (#314).
    expect(adapters.jellyfin().songs.reportsLoudness).toBe(true);

    // Emby shares that mapper and reports no such figure, which is why this
    // is the brand's answer and not MediaBrowser's.
    expect(adapters.emby().songs.reportsLoudness).toBe(false);

    // Plex exposes a per-part gain nothing maps yet: a mapper gap rather than
    // a server one, which flips to true in the change that reads it.
    expect(adapters.plex().songs.reportsLoudness).toBe(false);

    // Local files often carry ReplayGain tags; the importer does not read one.
    expect(adapters.local().songs.reportsLoudness).toBe(false);
  });

  it('offers five-star ratings only where the server keeps them apart from favourites', () => {
    // Subsonic's setRating is a field of its own, beside the starred flag.
    expect(adapters.navidrome().ratings).toBeDefined();

    // MediaBrowser's per-user data has Likes and no star count to write, so
    // there is nothing here to implement without inventing it.
    expect(adapters.jellyfin().ratings).toBeUndefined();
    expect(adapters.emby().ratings).toBeUndefined();

    // Plex has exactly one number, and the app already spends it: a favourite
    // on Plex *is* userRating 10, and unfavouriting writes 0. A ratings
    // surface here would mean three stars silently unfavourites a track.
    expect(adapters.plex().ratings).toBeUndefined();

    expect(adapters.local().ratings).toBeUndefined();
  });

  it('offers queue sync and the now-playing shelf only where the server backs them', () => {
    // Both switches live on the Server screen behind these two surfaces.
    expect(adapters.navidrome().queue).toBeDefined();
    for (const make of [adapters.jellyfin, adapters.emby, adapters.plex, adapters.local]) {
      expect(make().queue).toBeUndefined();
    }

    // Random draws and who is listening: every media server has them, files
    // on the device have neither.
    for (const make of [adapters.navidrome, adapters.jellyfin, adapters.emby, adapters.plex]) {
      expect(make().discovery).toBeDefined();
    }
    expect(adapters.local().discovery).toBeUndefined();
  });
});
