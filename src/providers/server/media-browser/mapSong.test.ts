import { serverProvenance } from '@/domain/identity/Provenance';
import { JELLYFIN_BRAND, EMBY_BRAND } from './brand';
import { mapSong } from './mapSong';
import type { MediaBrowserItem } from './types';

const provenance = serverProvenance('srv-1');

/** An `/Items?IncludeItemTypes=Audio` response entry. */
const fullDto: MediaBrowserItem = {
  Id: 'tr-100',
  Name: 'Everything In Its Right Place',
  Type: 'Audio',
  ArtistItems: [{ Id: 'ar-7', Name: 'Radiohead' }],
  AlbumId: 'al-3',
  AlbumArtist: 'Radiohead',
  AlbumPrimaryImageTag: 'tag-1',
  RunTimeTicks: 2_510_000_000, // 251 seconds
  MediaSources: [
    {
      RunTimeTicks: 2_510_000_000,
      Bitrate: 320_000,
      Container: 'mpeg',
      MediaStreams: [{ Type: 'Audio', BitRate: 320_000, SampleRate: 44100, BitDepth: 16 }],
    },
  ],
  Genres: ['Electronic, Rock'],
  ProviderIds: { MusicBrainzTrack: 'rec-mbid' },
  ProductionYear: 2000,
  PremiereDate: '2000-10-02T00:00:00.000Z',
  ParentIndexNumber: 1,
  IndexNumber: 1,
  DateCreated: '2024-03-02T10:15:00.000Z',
};

describe('mapSong', () => {
  it('produces a complete song from a full DTO', () => {
    const song = mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND });

    expect(song).toMatchObject({
      localId: 'local:song:srv:srv-1:tr-100',
      nativeId: 'tr-100',
      provenance: { origin: 'server', serverId: 'srv-1' },
      title: 'Everything In Its Right Place',
      durationSeconds: 251,
      contentKind: 'song',
      discNumber: 1,
      trackNumber: 1,
      year: 2000,
      releaseDate: '2000-10-02T00:00:00.000Z',
      genres: ['Electronic', 'Rock'],
    });
    expect(song.audio).toEqual({
      bitrateKbps: 320_000,
      sampleRateHz: 44100,
      bitsPerSample: 16,
      mimeType: 'audio/mpeg',
    });
  });

  // Several song endpoints already ask for PremiereDate; without this the
  // value arrived and was dropped on the floor.
  it('carries the release date through, and leaves it undefined when absent', () => {
    expect(mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND }).releaseDate).toBe('2000-10-02T00:00:00.000Z');
    expect(
      mapSong({ ...fullDto, PremiereDate: undefined }, { provenance, brand: JELLYFIN_BRAND }).releaseDate
    ).toBeUndefined();
  });

  it('converts RunTimeTicks (100ns ticks) to whole seconds', () => {
    const song = mapSong({ ...fullDto, RunTimeTicks: 1_234_567 }, { provenance, brand: JELLYFIN_BRAND });
    // 1,234,567 ticks / 10,000,000 ticks-per-second, rounded.
    expect(song.durationSeconds).toBe(0);
    const longer = mapSong({ ...fullDto, RunTimeTicks: 15_000_000 }, { provenance, brand: JELLYFIN_BRAND });
    expect(longer.durationSeconds).toBe(2);
  });

  it('derives identity from the provenance it is given, not from a client', () => {
    const other = mapSong(fullDto, { provenance: serverProvenance('srv-2'), brand: JELLYFIN_BRAND });
    expect(other.localId).toBe('local:song:srv:srv-2:tr-100');
  });

  it('references its artist and album rather than embedding them', () => {
    const song = mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND });
    expect(song.artist).toMatchObject({ localId: 'local:artist:srv:srv-1:ar-7', name: 'Radiohead' });
    expect(song.album.localId).toBe('local:album:srv:srv-1:al-3');
  });

  it('captures the track MusicBrainz id where the server reports one', () => {
    expect(mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND }).externalIds).toEqual({ mbid: 'rec-mbid' });
  });

  it('resolves a Jellyfin cover from the song item id', () => {
    const song = mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND });
    expect(song.cover).toEqual({ kind: 'jellyfin', itemId: 'tr-100' });
  });

  it("resolves an Emby cover from the parent album's id and image tag", () => {
    const song = mapSong(fullDto, { provenance, brand: EMBY_BRAND });
    expect(song.cover).toEqual({ kind: 'emby', itemId: 'al-3', tag: 'tag-1' });
  });

  it('produces a valid song from an all-but-empty DTO rather than throwing', () => {
    const song = mapSong({ Id: 'tr-1' }, { provenance, brand: JELLYFIN_BRAND });

    expect(song).toMatchObject({
      localId: 'local:song:srv:srv-1:tr-1',
      title: 'Unknown',
      durationSeconds: 0,
      contentKind: 'song',
      genres: [],
      externalIds: {},
    });
    expect(song.artist.name).toBe('Unknown Artist');
  });

  it('carries no stream URL, only the identity a stream can be built from', () => {
    expect(mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND })).not.toHaveProperty('streamUrl');
  });

  it('has no streamId, because MediaBrowser streams the same id as nativeId', () => {
    expect(mapSong(fullDto, { provenance, brand: JELLYFIN_BRAND }).streamId).toBeUndefined();
  });
  /**
   * #314: the preamp slider did nothing on Jellyfin, because the preamp is
   * added to a *measured* figure and nothing here ever read Jellyfin's.
   * Figures below are real ones, from a Jellyfin 12.4 server.
   */
  describe("the loudness Jellyfin measured", () => {
    it('carries the track figure as track gain, in dB', () => {
      const song = mapSong(
        { Id: 'tr-1', NormalizationGain: -6.6 },
        { provenance, brand: JELLYFIN_BRAND }
      );

      expect(song.loudness).toEqual({ trackGainDb: -6.6 });
    });

    it('carries the album figure too, where the album has one', () => {
      const song = mapSong(
        { Id: 'tr-1', NormalizationGain: -8.7, AlbumNormalizationGain: -8.1 },
        { provenance, brand: JELLYFIN_BRAND }
      );

      expect(song.loudness).toEqual({ trackGainDb: -8.7, albumGainDb: -8.1 });
    });

    it('leaves loudness absent when the server measured none', () => {
      // Not `{ trackGainDb: 0 }`: unmeasured and "already at reference
      // loudness" are different claims, and the engine treats them so.
      expect(mapSong({ Id: 'tr-1' }, { provenance, brand: JELLYFIN_BRAND }).loudness)
        .toBeUndefined();
    });

    it('keeps a measured zero, which is a figure and not an absence', () => {
      expect(mapSong({ Id: 'tr-1', NormalizationGain: 0 }, { provenance, brand: JELLYFIN_BRAND }).loudness)
        .toEqual({ trackGainDb: 0 });
    });
  });
});
