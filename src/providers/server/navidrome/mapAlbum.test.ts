import { serverProvenance } from '@/domain/identity/Provenance';
import type { LocalId } from '@/domain/identity/LocalId';
import { mapAlbum } from './mapAlbum';
import type { SubsonicAlbum, SubsonicAlbumListEntry } from './types';

const provenance = serverProvenance('srv-1');

/** The ID3 `getAlbum` shape: titled `name`, carries its track list. */
const id3Dto: SubsonicAlbum = {
  id: 'al-3',
  name: 'Kid A',
  artist: 'Radiohead',
  artistId: 'ar-7',
  coverArt: 'al-3',
  year: 2000,
  genre: 'Electronic',
  created: '2024-03-02T10:15:00.000Z',
  musicBrainzId: 'rg-mbid',
};

/** The `getAlbumList` shape: titled `title`, never carries tracks. */
const listDto: SubsonicAlbumListEntry = {
  id: 'al-4',
  title: 'Amnesiac',
  artist: 'Radiohead',
  artistId: 'ar-7',
  coverArt: 'al-4',
  year: 2001,
};

describe('mapAlbum', () => {
  it('produces a complete album from the ID3 shape', () => {
    expect(mapAlbum(id3Dto, { provenance })).toMatchObject({
      localId: 'local:album:srv:srv-1:al-3',
      nativeId: 'al-3',
      provenance: { origin: 'server', serverId: 'srv-1' },
      title: 'Kid A',
      year: 2000,
      releaseType: 'album',
      genres: ['Electronic'],
      songIds: [],
    });
  });

  /**
   * This mapper used to read only the singular `genre`, so an album the server
   * reported three genres for arrived carrying one — and the genre a library is
   * browsed by is the album's.
   */
  it('reads every genre the server reports, not just the first', () => {
    const multiGenre: SubsonicAlbum = {
      ...id3Dto,
      genres: [{ name: 'Electronic' }, { name: 'Art Rock' }, { name: 'Experimental' }],
    };

    expect(mapAlbum(multiGenre, { provenance }).genres).toEqual([
      'Electronic',
      'Art Rock',
      'Experimental',
    ]);
  });

  it('carries the mood tags the files were tagged with', () => {
    expect(mapAlbum({ ...id3Dto, moods: ['Melancholy', 'Nocturnal'] }, { provenance }).moods)
      .toEqual(['Melancholy', 'Nocturnal']);
  });

  it('leaves moods absent for a library that is not mood-tagged', () => {
    expect(mapAlbum(id3Dto, { provenance }).moods).toBeUndefined();
    expect(mapAlbum(listDto, { provenance }).moods).toBeUndefined();
  });

  it('reads the title out of either endpoint shape', () => {
    expect(mapAlbum(id3Dto, { provenance }).title).toBe('Kid A');
    expect(mapAlbum(listDto, { provenance }).title).toBe('Amnesiac');
  });

  it('records the album MBID as a release, which is what Navidrome reports (MbzAlbumID)', () => {
    expect(mapAlbum(id3Dto, { provenance }).externalIds)
      .toEqual({ mbid: 'rg-mbid', mbidType: 'release' });
  });

  it('names the album on a missing cover, so a backup can find it', () => {
    const { coverArt: _omitted, ...withoutArt } = id3Dto;
    void _omitted;
    expect(mapAlbum(withoutArt, { provenance }).cover).toEqual({
      kind: 'none',
      subject: { kind: 'album', title: 'Kid A', artistName: 'Radiohead', mbid: 'rg-mbid', mbidType: 'release' },
    });
  });

  it('leaves external ids empty when the server reports none', () => {
    expect(mapAlbum(listDto, { provenance }).externalIds).toEqual({});
  });

  it('references its artist rather than embedding one', () => {
    expect(mapAlbum(id3Dto, { provenance }).artist).toEqual({
      localId: 'local:artist:srv:srv-1:ar-7',
      nativeId: 'ar-7',
      externalIds: {},
      name: 'Radiohead',
      cover: { kind: 'none', subject: { kind: 'artist', name: 'Radiohead' } },
    });
  });

  it('takes its track references from the caller rather than mapping songs itself', () => {
    const songIds = ['local:song:srv:srv-1:tr-1', 'local:song:srv:srv-1:tr-2'] as LocalId[];

    expect(mapAlbum(id3Dto, { provenance, songIds }).songIds).toEqual(songIds);
  });

  it('produces a valid album from an all-but-empty DTO rather than throwing', () => {
    expect(mapAlbum({ id: 'al-9' }, { provenance })).toMatchObject({
      localId: 'local:album:srv:srv-1:al-9',
      title: 'Unknown Album',
      genres: [],
      songIds: [],
      cover: { kind: 'none' },
    });
  });
});

describe('embedded artist cover', () => {
  it('carries the artist cover the caller resolved, so the ref is not a broken image', () => {
    const album = mapAlbum(id3Dto, {
      provenance,
      artistCover: { kind: 'navidrome', coverArtId: 'ar-7' },
    });

    expect(album.artist.cover).toEqual({ kind: 'navidrome', coverArtId: 'ar-7' });
  });

  it('falls back to a gap naming the artist when the caller has no artist cover to give', () => {
    // Subsonic's album payload names the artist but carries no artwork for
    // them, so a caller that did not fetch the artist genuinely has none.
    expect(mapAlbum(id3Dto, { provenance }).artist.cover)
      .toEqual({ kind: 'none', subject: { kind: 'artist', name: 'Radiohead' } });
  });
});
