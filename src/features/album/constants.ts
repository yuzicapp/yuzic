/**
 * The album screen's shelves are the same shelf Home draws.
 *
 * These were 16, 12 and 2.5 written out again, with the same arithmetic over
 * them in three components — the numbers agreed with Home's by coincidence
 * and the formula did not. The scale and the rule now come from
 * `features/layout/shelf`; what is left here is about the *data* on those
 * shelves rather than their shape.
 */
export const ALBUM_RECOMMENDATION_RELATED_LIMIT = 30;
export const ALBUM_RECOMMENDATION_TARGET_ALBUMS = 8;

/**
 * What a track row and a disc header measure at the default text size and
 * density. The list estimates from these; `useAlbumRowHeights` moves them when
 * the user has chosen otherwise, which they now can without relaunching.
 */
export const ALBUM_ESTIMATED_ROW_HEIGHT = 72;
export const ALBUM_DISC_HEADER_HEIGHT = 36;
