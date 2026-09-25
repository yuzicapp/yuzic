import { serverProvenance } from '@/domain/identity/Provenance';
import type { LocalId } from '@/domain/identity/LocalId';
import { mapPlaylist } from './mapPlaylist';

const provenance = serverProvenance('srv-1');

describe('mapPlaylist', () => {
  it('produces a complete playlist carrying the same identity contract as every other entity', () => {
    expect(mapPlaylist(
      { id: 'pl-2', name: 'Late night', coverArt: 'pl-2', created: '2024-01-01T00:00:00.000Z', changed: '2024-06-01T00:00:00.000Z' },
      { provenance }
    )).toEqual({
      localId: 'local:playlist:srv:srv-1:pl-2',
      nativeId: 'pl-2',
      provenance: { origin: 'server', serverId: 'srv-1' },
      externalIds: {},
      title: 'Late night',
      cover: { kind: 'navidrome', coverArtId: 'pl-2' },
      isOwned: true,
      createdAt: Date.parse('2024-01-01T00:00:00.000Z'),
      updatedAt: Date.parse('2024-06-01T00:00:00.000Z'),
      songIds: [],
    });
  });

  it('takes its track references from the caller rather than mapping entries itself', () => {
    const songIds = ['local:song:srv:srv-1:tr-1'] as LocalId[];

    expect(mapPlaylist({ id: 'pl-2' }, { provenance, songIds }).songIds).toEqual(songIds);
  });

  it("marks another account's public playlist as not owned", () => {
    expect(mapPlaylist({ id: 'pl-3', owner: 'sam' }, { provenance, username: 'ari' }).isOwned).toBe(false);
    expect(mapPlaylist({ id: 'pl-4', owner: 'Ari' }, { provenance, username: 'ari' }).isOwned).toBe(true);
    // A server that does not say who owns it keeps the playlist editable.
    expect(mapPlaylist({ id: 'pl-5' }, { provenance, username: 'ari' }).isOwned).toBe(true);
  });

  it('leaves timestamps absent rather than zero when the server sends none', () => {
    const playlist = mapPlaylist({ id: 'pl-2' }, { provenance });

    expect(playlist.createdAt).toBeUndefined();
    expect(playlist.updatedAt).toBeUndefined();
    expect(playlist.title).toBe('Untitled playlist');
  });
});

/**
 * The server's own answers, where OpenSubsonic gives them. `canEdit` and
 * `description` are domain fields that existed for exactly this and went
 * unfilled because the DTO never declared the fields behind them.
 */
describe('mapPlaylist reading what the server reports', () => {
  it('carries the description the API calls a comment', () => {
    expect(mapPlaylist({ id: 'p-1', name: 'Mix', comment: 'Songs for driving' }, { provenance }).description)
      .toBe('Songs for driving');
  });

  it('believes `readonly` over guessing editability from the owner name', () => {
    expect(mapPlaylist({ id: 'p-1', name: 'Mix', owner: 'someone-else', readonly: false }, { provenance, username: 'me' }).canEdit)
      .toBe(true);
    expect(mapPlaylist({ id: 'p-1', name: 'Mix', owner: 'me', readonly: true }, { provenance, username: 'me' }).canEdit)
      .toBe(false);
  });

  it('leaves canEdit absent when the server does not say, so it falls back to ownership', () => {
    expect(mapPlaylist({ id: 'p-1', name: 'Mix', owner: 'me' }, { provenance, username: 'me' }).canEdit)
      .toBeUndefined();
  });
});
