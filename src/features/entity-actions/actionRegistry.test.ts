import { resolveActions } from './types';
import {
  actionRegistrySummary,
  songLibraryActions, type SongLibraryActionContext,
  songExternalActions, type SongExternalActionContext,
  albumLibraryActions, type AlbumLibraryActionContext,
  albumExternalActions, type AlbumExternalActionContext,
  artistActions, type ArtistActionContext,
  artistExternalActions, type ArtistExternalActionContext,
  playlistActions, type PlaylistActionContext,
} from './actionRegistry';

const noop = () => {};
const t = (key: string) => key;

/**
 * These tests exercise the declarative registries directly, as pure
 * data — no rendering, no hooks — proving the same thing the four sheets'
 * old per-component conditionals proved, but against the one shared
 * resolver (`resolveActions`) instead of four separate `if` ladders.
 */
describe('actionRegistrySummary', () => {
  it('lists a stable id set per entity kind/origin', () => {
    expect(actionRegistrySummary['song.library']).toEqual([
      'favorite', 'addToQueue', 'addToEnd', 'addToPlaylist', 'sleepTimer', 'download',
      'goToAlbum', 'goToArtist', 'instantMix', 'generatePlaylist',
    ]);
    expect(actionRegistrySummary['song.external']).toEqual(['play', 'inLibrary', 'want', 'getSong', 'get']);
    expect(actionRegistrySummary['album.library']).toEqual([
      'favorite', 'play', 'shuffle', 'addToNext', 'addToEnd', 'shuffleToQueue',
      'generatePlaylist', 'goToAlbum', 'viewExternal', 'share', 'download',
    ]);
    expect(actionRegistrySummary['album.external']).toEqual([
      'inLibrary', 'downloading', 'want', 'get', 'noServiceConnected',
      'goToArtist', 'share', 'openInSource',
    ]);
    expect(actionRegistrySummary.artist).toEqual([
      'play', 'shuffle', 'addToQueue', 'shuffleToQueue', 'generatePlaylist', 'download', 'goToArtist', 'viewExternal',
    ]);
    // Want leads, and the ownership row that settles it comes first — the
    // same shape as `album.external` above.
    expect(actionRegistrySummary['artist.external']).toEqual([
      'inLibrary', 'want', 'share', 'openInSource',
    ]);
    expect(actionRegistrySummary.playlist).toEqual([
      'play', 'shuffle', 'addToQueue', 'shuffleToQueue', 'goToPlaylist', 'download', 'share', 'editSongs', 'rename', 'delete',
    ]);
  });
});

function songLibraryCtx(overrides: Partial<SongLibraryActionContext> = {}): SongLibraryActionContext {
  return {
    kind: 'song', origin: 'library',
    song: { album: { nativeId: 'a1' }, artist: { nativeId: 'ar1' } } as SongLibraryActionContext['song'],
    t, colors: { secondary: '#000', subtext: '#666' }, close: noop,
    isStarred: false, isDownloaded: false, isDownloading: false, isGeneratingPlaylist: false, similarPlaylistAvailable: false,
    sleepTimer: { mode: 'off' }, sleepTimerAvailable: false,
    handlers: {
      toggleFavorite: noop, addToQueue: noop, addToEndQueue: noop, addToPlaylist: noop, sleepTimer: noop, download: noop,
      goToAlbum: noop, goToArtist: noop, instantMix: noop, generatePlaylist: noop,
    },
    ...overrides,
  };
}

describe('songLibraryActions', () => {
  it('renders every base action for a song with both an album and an artist', () => {
    const resolved = resolveActions(songLibraryActions, songLibraryCtx());
    expect(resolved.map(a => a.id)).toEqual([
      'favorite', 'addToQueue', 'addToEnd', 'addToPlaylist', 'download', 'goToAlbum', 'goToArtist', 'instantMix',
    ]);
  });

  it('offers the sleep timer only where the player asked for it', () => {
    expect(resolveActions(songLibraryActions, songLibraryCtx()).map(a => a.id)).not.toContain('sleepTimer');
    const ids = resolveActions(songLibraryActions, songLibraryCtx({ sleepTimerAvailable: true })).map(a => a.id);
    expect(ids.indexOf('sleepTimer')).toBe(ids.indexOf('addToPlaylist') + 1);
  });

  it('hides goToAlbum/goToArtist when the song carries no album/artist native id', () => {
    const ctx = songLibraryCtx({
      song: { album: { nativeId: '' }, artist: { nativeId: '' } } as SongLibraryActionContext['song'],
    });
    const ids = resolveActions(songLibraryActions, ctx).map(a => a.id);
    expect(ids).not.toContain('goToAlbum');
    expect(ids).not.toContain('goToArtist');
  });

  it('shows generatePlaylist only when a similarity service is connected (song\'s own gate)', () => {
    expect(resolveActions(songLibraryActions, songLibraryCtx({ similarPlaylistAvailable: false })).map(a => a.id))
      .not.toContain('generatePlaylist');
    expect(resolveActions(songLibraryActions, songLibraryCtx({ similarPlaylistAvailable: true })).map(a => a.id))
      .toContain('generatePlaylist');
  });

  it('disables the download row while a download is already in flight', () => {
    const resolved = resolveActions(songLibraryActions, songLibraryCtx({ isDownloading: true }));
    const download = resolved.find(a => a.id === 'download')!;
    expect(download.disabled).toBe(true);
    expect(download.loading).toBe(true);
  });
});

function songExternalCtx(overrides: Partial<SongExternalActionContext> = {}): SongExternalActionContext {
  return {
    kind: 'song', origin: 'external',
    song: { localId: 'local:song:ext:deezer:1' } as SongExternalActionContext['song'],
    t, colors: { secondary: '#000', placeholder: '#999' }, close: noop, onPlay: undefined,
    isWanted: false, isInLibrary: false, canDownload: false, canDownloadTrack: false,
    handlers: { play: noop, toggleWant: noop, openAlbumGet: noop, openTrackGet: noop },
    ...overrides,
  };
}

describe('songExternalActions', () => {
  it('shows only Want with no downloader connected and no onPlay', () => {
    expect(resolveActions(songExternalActions, songExternalCtx()).map(a => a.id)).toEqual(['want']);
  });

  it('adds Play, GetSong and Get once wired up', () => {
    const ids = resolveActions(songExternalActions, songExternalCtx({
      onPlay: noop, canDownload: true, canDownloadTrack: true,
    })).map(a => a.id);
    expect(ids).toEqual(['play', 'want', 'getSong', 'get']);
  });

  it('hides Want entirely when the song has no localId', () => {
    const ctx = songExternalCtx({ song: { localId: '' } as SongExternalActionContext['song'] });
    expect(resolveActions(songExternalActions, ctx).map(a => a.id)).not.toContain('want');
  });

  /**
   * Local first: a track the library already holds is not something to want or
   * to go and get again. Same shape as the external *album* sheet's inLibrary
   * row, and the flag behind it comes from the same rule
   * (features/library/localFirst).
   */
  it('replaces Want and Get with an inert "in library" row once the track is owned', () => {
    const ids = resolveActions(songExternalActions, songExternalCtx({
      isInLibrary: true, onPlay: noop, canDownload: true, canDownloadTrack: true,
    })).map(a => a.id);

    expect(ids).toEqual(['play', 'inLibrary']);
  });

  it('leaves the inLibrary row out — and Want in — for a track nobody owns', () => {
    const ids = resolveActions(songExternalActions, songExternalCtx()).map(a => a.id);

    expect(ids).toEqual(['want']);
  });
});

function albumLibraryCtx(overrides: Partial<AlbumLibraryActionContext> = {}): AlbumLibraryActionContext {
  return {
    kind: 'album', origin: 'library',
    album: { artist: { name: 'Some Artist' } } as AlbumLibraryActionContext['album'],
    t, colors: { secondary: '#000', subtext: '#666' }, close: noop,
    isStarred: false, playbackDisabled: false, songsLoading: false, isDownloaded: false, isDownloading: false,
    isSharing: false, canShare: false, isGeneratingPlaylist: false, canGeneratePlaylist: false,
    hasExternalSources: false, hideGoToAlbum: false,
    handlers: {
      toggleFavorite: noop, play: noop, shuffle: noop, addToNext: noop, addToEnd: noop, shuffleToQueue: noop,
      generatePlaylist: noop, goToAlbum: noop, viewExternal: noop, share: noop, download: noop,
    },
    ...overrides,
  };
}

describe('albumLibraryActions', () => {
  it('includes addToNext, which artist/playlist never had — see shared/playbackActions.ts', () => {
    expect(resolveActions(albumLibraryActions, albumLibraryCtx()).map(a => a.id)).toContain('addToNext');
    expect(resolveActions(artistActions, artistCtx()).map(a => a.id)).not.toContain('addToNext');
    expect(resolveActions(playlistActions, playlistCtx()).map(a => a.id)).not.toContain('addToNext');
  });

  it('gates generatePlaylist on canGeneratePlaylist (album/artist\'s own gate, distinct from song\'s)', () => {
    expect(resolveActions(albumLibraryActions, albumLibraryCtx({ canGeneratePlaylist: false })).map(a => a.id))
      .not.toContain('generatePlaylist');
    expect(resolveActions(albumLibraryActions, albumLibraryCtx({ canGeneratePlaylist: true })).map(a => a.id))
      .toContain('generatePlaylist');
  });

  it('hides Share when the api has no shares capability', () => {
    expect(resolveActions(albumLibraryActions, albumLibraryCtx({ canShare: false })).map(a => a.id)).not.toContain('share');
    expect(resolveActions(albumLibraryActions, albumLibraryCtx({ canShare: true })).map(a => a.id)).toContain('share');
  });

  it('hides viewExternal when there are no enabled external sources or no artist name', () => {
    expect(resolveActions(albumLibraryActions, albumLibraryCtx({ hasExternalSources: false })).map(a => a.id))
      .not.toContain('viewExternal');
    const noArtist = albumLibraryCtx({
      hasExternalSources: true,
      album: { artist: { name: '' } } as AlbumLibraryActionContext['album'],
    });
    expect(resolveActions(albumLibraryActions, noArtist).map(a => a.id)).not.toContain('viewExternal');
  });
});

function albumExternalCtx(overrides: Partial<AlbumExternalActionContext> = {}): AlbumExternalActionContext {
  return {
    kind: 'album', origin: 'external',
    album: { localId: 'local:album:ext:deezer:1' } as AlbumExternalActionContext['album'],
    t, colors: { secondary: '#000', muted: '#333', placeholder: '#999' }, close: noop,
    status: { kind: 'none' }, isWanted: false, canDownload: false,
    // Nothing identifies this stub publicly and it names no artist, so the
    // three record-level rows stay out unless a test asks for them.
    webSourceNameKey: null, canGoToArtist: false,
    handlers: { toggleWant: noop, openGet: noop, goToArtist: noop, share: noop, openInSource: noop },
    ...overrides,
  };
}

describe('albumExternalActions', () => {
  it('shows only the inert "in library" row when already matched, hiding Want/Get', () => {
    const ids = resolveActions(albumExternalActions, albumExternalCtx({ status: { kind: 'in_library' } })).map(a => a.id);
    expect(ids).toEqual(['inLibrary']);
  });

  it('shows only the inert "downloading" row while a matching acquisition is in flight', () => {
    const ids = resolveActions(
      albumExternalActions,
      albumExternalCtx({ status: { kind: 'downloading', progress: 42, source: 'lidarr' } })
    ).map(a => a.id);
    expect(ids).toEqual(['downloading']);
  });

  it('falls back to "no service connected" (disabled, not just absent) when nothing can Get it', () => {
    const ids = resolveActions(albumExternalActions, albumExternalCtx({ canDownload: false })).map(a => a.id);
    expect(ids).toContain('noServiceConnected');
    expect(ids).not.toContain('get');
  });

  /**
   * Where to go next and how to take the record out of the app are facts about
   * the album, not about whether you own it — so unlike Want/Get they survive
   * the `status` branch above.
   */
  it('offers the artist and the source page regardless of ownership', () => {
    const ctx = albumExternalCtx({
      status: { kind: 'in_library' },
      canGoToArtist: true,
      webSourceNameKey: 'settings.sources.deezer.name',
    });
    const ids = resolveActions(albumExternalActions, ctx).map(a => a.id);

    expect(ids).toEqual(['inLibrary', 'goToArtist', 'share', 'openInSource']);
  });

  it('leaves Share and Open in … out when no source addresses the album', () => {
    const ids = resolveActions(albumExternalActions, albumExternalCtx({ canGoToArtist: true })).map(a => a.id);

    expect(ids).toContain('goToArtist');
    expect(ids).not.toContain('share');
    expect(ids).not.toContain('openInSource');
  });
});

describe('artistExternalActions', () => {
  const artistExternalCtx = (
    overrides: Partial<ArtistExternalActionContext> = {}
  ): ArtistExternalActionContext => ({
    kind: 'artist', origin: 'external',
    artist: { localId: 'local:artist:ext:deezer:9' } as ArtistExternalActionContext['artist'],
    t, colors: { secondary: '#000' }, close: noop,
    isWanted: false, isInLibrary: false,
    webSourceNameKey: 'settings.sources.deezer.name',
    handlers: { toggleWant: noop, share: noop, openInSource: noop },
    ...overrides,
  });

  it('carries none of the library actions a browsed artist cannot do', () => {
    const ids = resolveActions(artistExternalActions, artistExternalCtx()).map(a => a.id);

    expect(ids).toEqual(['want', 'share', 'openInSource']);
    expect(ids).not.toContain('play');
    expect(ids).not.toContain('download');
  });

  it('leads with Want, the way the external album sheet does', () => {
    const ids = resolveActions(artistExternalActions, artistExternalCtx()).map(a => a.id);

    expect(ids[0]).toBe('want');
  });

  it('says so once the want is saved, and never offers to fetch anything itself', () => {
    const actions = resolveActions(artistExternalActions, artistExternalCtx({ isWanted: true }));

    expect(actions.find(a => a.id === 'want')?.label).toBe('externalAlbum.menu.wanted');
    // Wanting an artist saves and nothing else: a Get lives on the Wants
    // screen, behind its own tap.
    expect(actions.map(a => a.id)).not.toContain('get');
  });

  /**
   * Owning them settles it, the same way the external album sheet's
   * "In Library" row settles Want and Get there.
   */
  it('replaces Want with an inert In Library row for an artist already held', () => {
    const actions = resolveActions(artistExternalActions, artistExternalCtx({ isInLibrary: true }));

    expect(actions.map(a => a.id)).toEqual(['inLibrary', 'share', 'openInSource']);
    expect(actions.find(a => a.id === 'inLibrary')?.disabled).toBe(true);
  });

  it('still offers Want when no source addresses the artist', () => {
    const ids = resolveActions(artistExternalActions, artistExternalCtx({ webSourceNameKey: null })).map(a => a.id);

    // Share and "Open in …" need a public page; saving one does not.
    expect(ids).toEqual(['want']);
  });
});

function artistCtx(overrides: Partial<ArtistActionContext> = {}): ArtistActionContext {
  return {
    kind: 'artist', origin: 'library',
    artist: {} as ArtistActionContext['artist'],
    t, colors: { secondary: '#000', subtext: '#666' }, close: noop,
    playbackDisabled: false, songsLoading: false, isDownloaded: false, isDownloading: false,
    isGeneratingPlaylist: false, canGeneratePlaylist: false, hasExternalSources: false, hideGoToArtist: false,
    handlers: { play: noop, shuffle: noop, addToQueue: noop, shuffleToQueue: noop, generatePlaylist: noop, downloadAll: noop, goToArtist: noop, viewExternal: noop },
    ...overrides,
  };
}

describe('artistActions', () => {
  it('hides goToArtist when already on the artist screen', () => {
    expect(resolveActions(artistActions, artistCtx({ hideGoToArtist: true })).map(a => a.id)).not.toContain('goToArtist');
    expect(resolveActions(artistActions, artistCtx({ hideGoToArtist: false })).map(a => a.id)).toContain('goToArtist');
  });
});

function playlistCtx(overrides: Partial<PlaylistActionContext> = {}): PlaylistActionContext {
  return {
    kind: 'playlist', origin: 'library',
    playlist: { isOwned: true } as PlaylistActionContext['playlist'],
    t, colors: { secondary: '#000', subtext: '#666' }, close: noop,
    playbackDisabled: false, songsLoading: false, isDownloaded: false, isDownloading: false,
    isSharing: false, canShare: false, isFavorites: false, isDeleting: false, hideGoToPlaylist: false,
    canEditSongs: false,
    handlers: { editSongs: noop, play: noop, shuffle: noop, addToQueue: noop, shuffleToQueue: noop, goToPlaylist: noop, download: noop, share: noop, rename: noop, delete: noop },
    ...overrides,
  };
}

describe('playlistActions', () => {
  it('hides rename/delete for the Favorites playlist', () => {
    const ids = resolveActions(playlistActions, playlistCtx({ isFavorites: true })).map(a => a.id);
    expect(ids).not.toContain('rename');
    expect(ids).not.toContain('delete');
  });

  it('shows rename/delete for an ordinary playlist', () => {
    const ids = resolveActions(playlistActions, playlistCtx({ isFavorites: false })).map(a => a.id);
    expect(ids).toContain('rename');
    expect(ids).toContain('delete');
  });

  it("hides rename/delete for another account's playlist", () => {
    const ids = resolveActions(playlistActions, playlistCtx({ playlist: { isOwned: false } as PlaylistActionContext['playlist'] })).map(a => a.id);
    expect(ids).not.toContain('rename');
    expect(ids).not.toContain('delete');
  });

  it('lets an account shared with edit rights rename but not delete', () => {
    const shared = { isOwned: false, canEdit: true } as PlaylistActionContext['playlist'];
    const ids = resolveActions(playlistActions, playlistCtx({ playlist: shared })).map(a => a.id);
    expect(ids).toContain('rename');
    expect(ids).not.toContain('delete');
  });

  it('offers Edit songs only when the context says the songs can be edited', () => {
    expect(resolveActions(playlistActions, playlistCtx()).map(a => a.id)).not.toContain('editSongs');
    expect(resolveActions(playlistActions, playlistCtx({ canEditSongs: true })).map(a => a.id)).toContain('editSongs');
  });

  it('marks delete as destructive-styled (red label) and disables it mid-delete', () => {
    const resolved = resolveActions(playlistActions, playlistCtx({ isDeleting: true }));
    const del = resolved.find(a => a.id === 'delete')!;
    expect(del.disabled).toBe(true);
    expect(del.loading).toBe(true);
    expect(del.labelColor).toBeTruthy();
  });
});
