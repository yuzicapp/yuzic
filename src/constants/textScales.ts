/**
 * The text sizes offered in Appearance, as multiples of the type scale.
 *
 * Applied by `components/Text` as it draws. This used to be read out of the
 * persisted redux blob at module load — before any style was built — because
 * the type roles baked the size in at import time and could not be recomputed.
 * That is what made the setting wait for a restart, and it is gone: the roles
 * keep their written sizes and the multiple lands per `Text`.
 */
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3] as const;
