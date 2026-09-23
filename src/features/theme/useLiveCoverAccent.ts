import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ImageColors from 'react-native-image-colors';

import { usePlayingState } from '@/features/playback/PlayingContext';
import { buildCover } from '@/providers/registry/covers';
import { selectStoredTheme, setLiveAccent } from '@/features/settings/appearance/state';
import { ACCENT_CACHE_MAX, createAccentCache, pickAccent } from './coverAccent';
import { ensureContrast, mix } from './color';
import { DEFAULT_THEME } from './presets';
import { onDark } from '@/constants/design';

const accents = createAccentCache<string>(ACCENT_CACHE_MAX);

/**
 * A cover's most colourful swatch, made fit to be the app's accent.
 *
 * The accent is filled behind white text (a play button, a selected pill), so
 * it is darkened just far enough for that text to read, and written as six-digit
 * hex, which `tinted` assumes.
 */
export function accentFromCover(extracted: Parameters<typeof pickAccent>[0], fallback: string): string {
  const picked = pickAccent(extracted, fallback);
  return ensureContrast(mix(picked, picked, 0), [onDark.text], 3);
}

/**
 * Keep the live accent in step with what is playing, while the theme asks for it.
 *
 * Mounted once, beside the player, so the extraction runs once per track rather
 * than once per component. The colour goes into the appearance state, where
 * `selectActiveTheme` puts it in place of the theme's own accent; nothing else
 * has to know it exists. Cleared when the setting is off or nothing is playing,
 * so the theme's own accent comes back.
 */
export function useLiveCoverAccent(): void {
  const dispatch = useDispatch();
  const theme = useSelector(selectStoredTheme);
  const following = theme?.accentFromCover === true;
  const { currentSong } = usePlayingState();
  const uri = following && currentSong ? buildCover(currentSong.cover, 'detail') : null;
  const fallback = theme?.accent ?? DEFAULT_THEME.accent;

  useEffect(() => {
    if (!uri) {
      dispatch(setLiveAccent(null));
      return;
    }
    const cached = accents.get(uri);
    if (cached) {
      dispatch(setLiveAccent(cached));
      return;
    }
    // A fast skip can outrun the extraction; a late answer must not win.
    let current = true;
    ImageColors.getColors(uri, { fallback })
      .then(result => {
        const accent = accentFromCover(result as Parameters<typeof pickAccent>[0], fallback);
        accents.set(uri, accent);
        if (current) dispatch(setLiveAccent(accent));
      })
      .catch(() => {
        if (current) dispatch(setLiveAccent(null));
      });
    return () => { current = false; };
  }, [dispatch, fallback, uri]);
}
