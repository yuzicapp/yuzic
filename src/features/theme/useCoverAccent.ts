import { useEffect, useState } from 'react'
import ImageColors from 'react-native-image-colors'

import { onDark } from '@/constants/design'
import { buildCover } from '@/providers/registry/covers'
import { useActiveTheme } from './useActiveTheme';
import type { CoverSource } from '@/domain/entities/Cover';
import { ACCENT_CACHE_MAX, createAccentCache, pickAccent, toWashAccent } from './coverAccent'

const accents = createAccentCache<string>(ACCENT_CACHE_MAX)

/**
 * A cover's accent, made fit to sit behind text, or null until there is one.
 *
 * Null rather than a default colour so a screen can render its ordinary
 * background and fade the accent in once it arrives, instead of flashing a grey
 * band on the way to the real one. Null is also the answer when the user has
 * turned cover tinting off, which is why the setting needs no separate branch
 * at any call site — a screen with no accent is a screen it already knows how
 * to draw. Extraction is skipped entirely in that case rather than run and
 * discarded.
 */
export function useCoverAccent(cover: CoverSource | undefined): string | null {
  const enabled = useActiveTheme().surface.coverTint
  const [accent, setAccent] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !cover) {
      setAccent(null)
      return
    }
    const uri = buildCover(cover, 'detail')
    if (!uri) {
      setAccent(null)
      return
    }

    const cached = accents.get(uri)
    if (cached) {
      setAccent(cached)
      return
    }

    // The cover can change before extraction finishes — a fast scroll through
    // pushed screens — and the late result must not paint over the new one.
    let current = true
    setAccent(null)
    ImageColors.getColors(uri, { fallback: onDark.wash })
      .then(result => {
        const value = toWashAccent(pickAccent(result, onDark.wash))
        accents.set(uri, value)
        if (current) setAccent(value)
      })
      .catch(() => {
        if (current) setAccent(null)
      })

    return () => {
      current = false
    }
  }, [cover, enabled])

  return accent
}
