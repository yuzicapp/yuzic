import { classifyTrackPlayability, playableSongs, resolveTrackPlayability } from './trackPlayability'
import type { Song } from '@/domain/entities/Song'
import type { LocalId } from '@/domain/identity/LocalId'

const artistRef = { localId: 'local:artist:srv:s1:a1' as LocalId, nativeId: 'a1', name: 'Artist', cover: { kind: 'none' as const }, externalIds: {} }
const albumRef = { localId: 'local:album:srv:s1:al1' as LocalId, nativeId: 'al1', title: 'Album', cover: { kind: 'none' as const }, externalIds: {} }

/** A track from the user's own server. */
function song(id: string, overrides: Partial<Song> = {}): Song {
  return {
    localId: `local:song:srv:s1:${id}` as LocalId,
    nativeId: id,
    provenance: { origin: 'server', serverId: 's1' },
    externalIds: {},
    libraryState: 'in-library',
    title: `Song ${id}`,
    artist: artistRef,
    album: albumRef,
    cover: { kind: 'none' },
    durationSeconds: 180,
    contentKind: 'song',
    genres: [],
    ...overrides,
  }
}

/** A track as a catalogue hands it over — what a browsed album is made of. */
function browsedSong(id: string, overrides: Partial<Song> = {}): Song {
  return song(id, {
    localId: `local:song:int:deezer:${id}` as LocalId,
    provenance: { origin: 'integration', providerId: 'deezer' },
    libraryState: 'external',
    contentKind: 'preview',
    durationSeconds: 30,
    ...overrides,
  })
}

describe('resolveTrackPlayability', () => {
  it('is always full for a local library album, regardless of preview data', () => {
    const s = song('1')
    expect(resolveTrackPlayability(s, true, {})).toEqual({ kind: 'full' })
    expect(resolveTrackPlayability(s, true, { '1': 'https://preview' })).toEqual({ kind: 'full' })
  })

  it('is preview for an external track whose clip resolved', () => {
    const s = browsedSong('1')
    expect(resolveTrackPlayability(s, false, { '1': 'https://preview.mp3' }))
      .toEqual({ kind: 'preview', streamId: 'https://preview.mp3' })
  })

  it('is unavailable for an external track with no resolved clip', () => {
    const s = browsedSong('1')
    expect(resolveTrackPlayability(s, false, {})).toEqual({ kind: 'unavailable' })
  })

  /**
   * Local first: the browsed album's track list has already been resolved
   * against the library (features/library/localFirst), so a track that came
   * back as the library's own is streamed in full — a clip for it would be the
   * app picking thirty seconds over a recording the user owns.
   */
  it('is full for a library track on a browsed album, even when a clip exists', () => {
    const owned = song('1')
    expect(resolveTrackPlayability(owned, false, { '1': 'https://preview.mp3' })).toEqual({ kind: 'full' })
  })
})

describe('classifyTrackPlayability', () => {
  it('classifies every song by its own local id', () => {
    const songs = [browsedSong('1'), browsedSong('2')]
    const result = classifyTrackPlayability(songs, false, { '1': 'https://p1' })

    expect(result.get(songs[0].localId)).toEqual({ kind: 'preview', streamId: 'https://p1' })
    expect(result.get(songs[1].localId)).toEqual({ kind: 'unavailable' })
  })

  it('mixes full and preview tracks on one browsed album', () => {
    const songs = [song('1'), browsedSong('2')]
    const result = classifyTrackPlayability(songs, false, { '1': 'https://p1', '2': 'https://p2' })

    expect(result.get(songs[0].localId)).toEqual({ kind: 'full' })
    expect(result.get(songs[1].localId)).toEqual({ kind: 'preview', streamId: 'https://p2' })
  })
})

describe('playableSongs', () => {
  it('keeps full tracks unchanged', () => {
    const songs = [song('1')]
    const playability = classifyTrackPlayability(songs, true, {})
    expect(playableSongs(songs, playability)).toEqual(songs)
  })

  it('attaches the clip url as streamId for preview tracks', () => {
    const songs = [browsedSong('1')]
    const playability = classifyTrackPlayability(songs, false, { '1': 'https://p1' })
    const result = playableSongs(songs, playability)
    expect(result).toHaveLength(1)
    expect(result[0].streamId).toBe('https://p1')
  })

  it('leaves an owned track alone rather than attaching a clip to it', () => {
    const songs = [song('1')]
    const playability = classifyTrackPlayability(songs, false, { '1': 'https://p1' })

    expect(playableSongs(songs, playability)[0].streamId).toBeUndefined()
  })

  it('drops unavailable tracks entirely', () => {
    const songs = [browsedSong('1'), browsedSong('2')]
    const playability = classifyTrackPlayability(songs, false, { '2': 'https://p2' })
    const result = playableSongs(songs, playability)
    expect(result.map(s => s.nativeId)).toEqual(['2'])
  })
})
