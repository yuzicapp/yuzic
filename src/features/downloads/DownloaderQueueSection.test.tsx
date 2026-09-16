import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import DownloaderQueueSection from './DownloaderQueueSection';
import type { DownloaderQueueItem } from '@/features/downloaders/queueItem';

// The toast module's barrel also exports its host, which pulls in the gesture
// handler — not transformable here, and nothing this test looks at.
jest.mock('@/components/toast', () => ({
  notify: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', border: '#ccc', muted: '#eee', themeColor: '#0f0' } }),
}));
jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ thumb: 8, pill: 999 }),
}));
jest.mock('@/features/settings/downloaders/useQueueRowSubtitle', () => ({
  useQueueRowSubtitle: () => (item: { artistName: string }) => item.artistName,
}));

const mockMediaImage = jest.fn();
jest.mock('@/components/MediaImage', () => ({
  MediaImage: (props: { cover: unknown }) => { mockMediaImage(props.cover); return null; },
}));

const libraryAlbum = {
  nativeId: 'al-1',
  title: 'Rumours',
  artist: { name: 'Fleetwood Mac' },
  cover: { kind: 'navidrome', coverArtId: 'al-1' },
};
jest.mock('@/features/album/useAlbums', () => ({
  useAlbums: () => ({ albums: [libraryAlbum] }),
}));

const item = (over: Partial<DownloaderQueueItem>): DownloaderQueueItem => ({
  id: 'q1',
  percentComplete: 40,
  title: 'Rumours',
  artistName: 'Fleetwood Mac',
  active: true,
  identity: 'exact',
  transferIds: ['t1'],
  ...over,
});

/**
 * The Downloads screen used to be settings cards with nothing to press. A
 * transfer for an album the library already has now carries that album's cover
 * and opens it.
 */
describe('DownloaderQueueSection', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockMediaImage.mockClear();
  });

  it('shows the library album\'s cover for a matching transfer and opens the album', async () => {
    const view = await render(
      <DownloaderQueueSection id="lidarr" title="Lidarr" items={[item({})]} isLoading={false} hasError={false} />
    );

    expect(mockMediaImage).toHaveBeenCalledWith(libraryAlbum.cover);
    fireEvent.press(view.getByTestId('downloads-queue-row'));
    expect(mockNavigate).toHaveBeenCalledWith('albumView', { id: 'al-1' });
  });

  /**
   * Why this screen drew nothing. A transfer in flight is by definition not in
   * the library yet, so every row that mattered fell to the fallback — and the
   * fallback was a gap about nobody, which the one picture rule returns
   * untouched. Naming the subject is all it needs to go and ask an artwork
   * backup, so the row can show the cover before the album lands.
   */
  it('names the album a transfer is for, so its cover can be found before it arrives', async () => {
    const view = await render(
      <DownloaderQueueSection
        id="slskd"
        title="slskd"
        items={[item({ title: 'Some Other Record', artistName: 'Nobody', identity: 'loose' })]}
        isLoading={false}
        hasError={false}
      />
    );

    expect(mockMediaImage).toHaveBeenCalledWith({
      kind: 'none',
      subject: { kind: 'album', title: 'Some Other Record', artistName: 'Nobody' },
    });
    fireEvent.press(view.getByTestId('downloads-queue-row'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to the peer when the downloader could not name an artist', async () => {
    // slskd frequently cannot; the remote user is then the only attribution
    // there is, and a subject naming nobody would find nothing.
    await render(
      <DownloaderQueueSection
        id="slskd"
        title="slskd"
        items={[item({ title: 'Some Other Record', artistName: '', peer: 'someuser', identity: 'loose' })]}
        isLoading={false}
        hasError={false}
      />
    );

    expect(mockMediaImage).toHaveBeenCalledWith({
      kind: 'none',
      subject: { kind: 'album', title: 'Some Other Record', artistName: 'someuser' },
    });
  });

  it('says the queue is empty rather than drawing nothing', async () => {
    const view = await render(
      <DownloaderQueueSection id="lidarr" title="Lidarr" items={[]} isLoading={false} hasError={false} />
    );
    expect(view.getByText('settings.downloaders.emptyQueue')).toBeTruthy();
  });
});
