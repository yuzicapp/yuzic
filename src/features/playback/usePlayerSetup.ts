import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { getBackend } from '@/features/player/activeBackend';
import { presetToBands } from '@/features/player/audioSettings';
import { selectCrossfadeAlways, selectCrossfadeSeconds, selectEqualizerGains, selectLoudnessNormalization, selectLoudnessPreampDb } from '@/features/settings/playback/state';

/**
 * Whether the player has been set up this launch.
 *
 * Module-level rather than a `useRef` so it survives a remount of the
 * provider: `setup()` claims the audio session and subscribes the event
 * listener, and doing that twice would rebuild the audio graph underneath a
 * playing track.
 */
const playerSetUp = { current: false };

/**
 * Brings the player up once per launch and keeps its audio settings current.
 */
export function usePlayerSetup(): void {
  // `setCommands` is deliberately *outside* the guard. Re-asserting the
  // remote commands is the only way to reclaim the lock-screen controls from
  // anything else that has called `removeTarget(nil)` on the shared command
  // centre.
  useEffect(() => {
    if (!playerSetUp.current) {
      try {
        getBackend().setup();
        playerSetUp.current = true;
      } catch (err) {
        console.warn('player setup failed', err);
      }
    }
    getBackend().setCommands();
  }, []);

  // Selected as primitives and rebuilt here rather than selected as objects:
  // a selector that constructs its result hands back a new value every render
  // and would re-send the settings forever.
  const crossfadeSeconds = useSelector(selectCrossfadeSeconds);
  const crossfadeAlways = useSelector(selectCrossfadeAlways);
  const equalizerGains = useSelector(selectEqualizerGains);
  const loudnessNormalization = useSelector(selectLoudnessNormalization);
  const loudnessPreampDb = useSelector(selectLoudnessPreampDb);
  const crossfade = useMemo(
    () =>
      crossfadeSeconds > 0
        ? {
            durationSec: crossfadeSeconds,
            mode: crossfadeAlways ? ('always' as const) : ('gapless-aware' as const),
            skipIsImmediate: true,
          }
        : null,
    [crossfadeSeconds, crossfadeAlways],
  );
  const equalizerBands = useMemo(() => presetToBands(equalizerGains), [equalizerGains]);
  const loudness = useMemo(
    () => ({ enabled: loudnessNormalization, preampDb: loudnessPreampDb }),
    [loudnessNormalization, loudnessPreampDb],
  );

  // Pushed whenever they change, so a slider takes effect immediately rather
  // than at the next launch. Both are safe to re-send: the engine bypasses a
  // flat EQ and a null crossfade outright.
  useEffect(() => { getBackend().setCrossfade(crossfade); }, [crossfade]);
  useEffect(() => { getBackend().setEqualizer(equalizerBands); }, [equalizerBands]);
  useEffect(() => { getBackend().setLoudness(loudness); }, [loudness]);
}
