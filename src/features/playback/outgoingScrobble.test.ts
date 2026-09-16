import type { Song } from '@/domain/entities/Song';
import type { QueueSegment } from './playingQueue';
import { captureOutgoingScrobble, deferOffTrackChange, OUTGOING_SCROBBLE_DELAY_MS } from './outgoingScrobble';

const song = { localId: 'song:1', nativeId: '1' } as unknown as Song;

/**
 * The outgoing listen is recorded after the track change is drawn, with what
 * was true when the change happened.
 */
describe('captureOutgoingScrobble', () => {
  it('reads the start time and collection when called, not when sent', async () => {
    let startedAt = 1000;
    let index = 0;
    const segments: QueueSegment[] = [
      { startIndex: 0, length: 1, source: { kind: 'user', contextType: 'playlist', contextId: 'pl-1' } },
      { startIndex: 1, length: 1, source: { kind: 'user', contextType: 'album', contextId: 'al-1' } },
    ];
    const scrobble = jest.fn(async () => {});

    const send = captureOutgoingScrobble(
      { segments: () => segments, currentIndex: () => index, listenStartedAt: () => startedAt, scrobble },
      song,
      120,
    );

    // What the track change does straight after: a new listen, a new pointer.
    startedAt = 9999;
    index = 1;
    await send();

    expect(scrobble).toHaveBeenCalledWith(song, { listenedSeconds: 120, startTime: 1000, playlistId: 'pl-1' });
  });
});

describe('deferOffTrackChange', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not send inside the track change, and sends after the delay', () => {
    const send = jest.fn(async () => {});
    deferOffTrackChange(send);
    expect(send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(OUTGOING_SCROBBLE_DELAY_MS - 1);
    expect(send).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed send rather than leaving an unhandled rejection', async () => {
    const send = jest.fn(async () => { throw new Error('offline'); });
    deferOffTrackChange(send);
    jest.advanceTimersByTime(OUTGOING_SCROBBLE_DELAY_MS);
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
