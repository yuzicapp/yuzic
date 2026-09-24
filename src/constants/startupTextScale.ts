import { mmkv } from '@/state/mmkvStorage';

/** The sizes offered, as multiples of the type scale. */
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3] as const;

const PERSIST_KEY = 'persist:settingsAppearance';

/**
 * The user's text size, read out of the persisted appearance settings.
 *
 * Read once, before any style is built, for the same reason the system text
 * size is: the type roles are static objects spread into `StyleSheet.create`
 * at import time, and the alternative is a hook at every one of several
 * hundred call sites. So a new size applies the next time the app starts.
 *
 * redux-persist stores each key of a slice as its own JSON string, hence the
 * double parse. Anything missing, malformed or outside the offered range is
 * the default size rather than a guess.
 */
export function textScaleFromPersisted(raw: string | null | undefined): number {
  try {
    if (!raw) return 1;
    const blob = JSON.parse(raw) as Record<string, string>;
    const theme = typeof blob.theme === 'string' ? JSON.parse(blob.theme) : blob.theme;
    const scale = theme?.shape?.textScale;
    return typeof scale === 'number' && (TEXT_SCALES as readonly number[]).includes(scale) ? scale : 1;
  } catch {
    return 1;
  }
}

export function readStartupTextScale(): number {
  try {
    return textScaleFromPersisted(mmkv.getString(PERSIST_KEY));
  } catch {
    return 1;
  }
}
