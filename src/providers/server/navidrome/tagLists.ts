/**
 * The tag lists Subsonic reports two ways.
 *
 * OpenSubsonic added array fields — `genres`, `moods` — beside the single
 * `genre` string the original API had. Which one a server sends depends on its
 * age, and a client that reads only one of them is wrong on half of them: the
 * album mapper read only the legacy singular field, so a multi-genre album
 * arrived carrying one genre on every server that reports the list properly.
 *
 * Shared by the song and album mappers because the two DTOs answer this
 * identically, and the one that had the logic had it as a private function.
 */

/** OpenSubsonic reports a genre as `{ name }`; some servers as a plain string. */
type GenreRef = { name?: string } | string;

const named = (entry: GenreRef): string | undefined =>
  typeof entry === 'string' ? entry : entry?.name;

/**
 * Every genre the origin names, preferring the list over the single field.
 *
 * The legacy field is a fallback rather than an addition: a server that sends
 * both sends the same first genre in each, so reading both would double it.
 */
export function genresOf(dto: { genre?: string; genres?: GenreRef[] }): string[] {
  if (Array.isArray(dto.genres) && dto.genres.length > 0) {
    return dto.genres.map(named).filter((genre): genre is string => Boolean(genre));
  }
  return dto.genre ? [dto.genre] : [];
}

/**
 * The mood tags the origin reports, or absent where it reports none.
 *
 * Undefined rather than `[]` on purpose — see `Album.moods`. There is no
 * legacy singular field to fall back to: moods arrived with OpenSubsonic, so a
 * server that does not send the array has nothing to say about mood at all.
 */
export function moodsOf(dto: { moods?: unknown }): string[] | undefined {
  if (!Array.isArray(dto.moods)) return undefined;
  const moods = dto.moods.filter((mood): mood is string => typeof mood === 'string' && mood.trim() !== '');
  return moods.length > 0 ? moods : undefined;
}
