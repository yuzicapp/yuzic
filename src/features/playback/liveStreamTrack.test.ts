import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import { stationToSong } from '@/features/radio/buildStationSong';
import { toEngineTrack, toMediaItem } from '@/features/player/engineBackend';
import { buildTrackItem } from './buildTrackItem';

// Store boundary, as in buildTrackItem.test.ts: every fixture here has no cover.
jest.mock('@/providers/registry/covers', () => ({
  buildCover: () => null,
}));

/**
 * A radio station has to reach the engine marked `continuous`.
 *
 * The engine picks its parser from that flag. Without it a station is read
 * like a file, and a file parser waits for the end of a broadcast that has
 * none — so internet radio did not play at all.
 */
describe('a live stream on its way to the engine', () => {
  const station = stationToSong(
    { id: 'st-1', name: 'Lofi Radio', streamUrl: 'https://radio.example/lofi' },
    'srv-1'
  );

  it('is continuous, with no duration', () => {
    const track = toEngineTrack(buildTrackItem({ song: station, streamUrl: 'https://radio.example/lofi' }));
    expect(track.continuous).toBe(true);
    expect(track.durationSec).toBeUndefined();
    expect(track.uri).toBe('https://radio.example/lofi');
  });

  it('stays continuous when the engine hands the track back', () => {
    const back = toMediaItem(toEngineTrack(buildTrackItem({ song: station, streamUrl: 'https://radio.example/lofi' })));
    expect(back.continuous).toBe(true);
  });

  it('leaves an ordinary song without the flag', () => {
    const provenance = serverProvenance('srv-1');
    const song: Song = {
      ...station,
      localId: makeLocalId('song', provenance, 'song-1'),
      nativeId: 'song-1',
      durationSeconds: 200,
      contentKind: 'song',
    };
    const track = toEngineTrack(buildTrackItem({ song, streamUrl: 'https://example.com/song.mp3' }));
    expect(track.continuous).toBeUndefined();
    expect('continuous' in track).toBe(false);
  });
});
