import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where `ExternalResolutionProvider` is mounted, as a test rather than a
 * comment.
 *
 * It used to be mounted in `app/(home)/_layout.tsx`, which covers the
 * browsing screens and nothing else. Two of its consumers do not live there:
 * `SongActionSheetProvider` (via `useSongActions`) and `PlayerHost` (via
 * `PlayingScreen`) are both rendered by the root layout, one level above. So
 * tapping a song, or opening a song's options from any tab, called
 * `useExternalResolution` with no provider above it and threw into the
 * ErrorBoundary: audio kept playing while the UI sat behind a full-screen
 * "Something went wrong" (#325, shipped in 2.17.1 on both platforms).
 *
 * Nothing about that failure is visible from either layout on its own, and a
 * type checker cannot see it either — a context hook that throws at runtime
 * type-checks fine wherever it is called. Hence this: it reads the two layouts
 * and asserts the nesting that makes the hook safe. Checking the source text
 * is blunt, but the thing being protected *is* the source's shape, and the
 * alternative — rendering the real root layout — needs the fonts, the splash
 * screen and the native player.
 */
const appDir = join(__dirname, '..', '..', 'app');
const rootLayout = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
const homeLayout = readFileSync(join(appDir, '(home)', '_layout.tsx'), 'utf8');

describe('ExternalResolutionProvider mount point', () => {
  it('is mounted by the root layout', () => {
    expect(rootLayout).toContain('<ExternalResolutionProvider>');
    expect(rootLayout).toContain('</ExternalResolutionProvider>');
  });

  it('is not mounted by the (home) layout, which misses the root-level consumers', () => {
    expect(homeLayout).not.toContain('ExternalResolutionProvider');
  });

  it.each([
    ['SongActionSheetProvider', '<SongActionSheetProvider>'],
    ['PlayerHost', '<PlayerHost />'],
  ])('opens before %s, so that consumer sees the context', (_name, consumer) => {
    const provider = rootLayout.indexOf('<ExternalResolutionProvider>');
    const closed = rootLayout.indexOf('</ExternalResolutionProvider>');
    const at = rootLayout.indexOf(consumer);

    expect(at).toBeGreaterThan(-1);
    expect(provider).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(provider);
    expect(at).toBeLessThan(closed);
  });

  it('is inside BottomSheetModalProvider, which its picker sheets need', () => {
    const sheetPortal = rootLayout.indexOf('<BottomSheetModalProvider>');
    const provider = rootLayout.indexOf('<ExternalResolutionProvider>');

    expect(sheetPortal).toBeGreaterThan(-1);
    expect(provider).toBeGreaterThan(sheetPortal);
  });
});
