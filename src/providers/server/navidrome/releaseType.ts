import type { ReleaseType } from '@/domain/entities/Album'

/**
 * What kind of release the server says this is.
 *
 * The album mapper used to hard-code `'album'` under a comment claiming
 * Subsonic had no release-type field. OpenSubsonic does: `releaseTypes` on
 * AlbumID3, carrying MusicBrainz's own vocabulary — "Album", "Single", "EP",
 * "Compilation", "Remix", "Live" — plus an `isCompilation` flag. So the
 * artist screen was splitting Albums from Singles & EPs by counting tracks and
 * running a regex over the title while the server was holding the answer.
 *
 * MusicBrainz splits a *primary* type (Album, Single, EP) from *secondary*
 * types (Compilation, Live, Remix, Soundtrack), and one release carries both —
 * `["Album", "Compilation"]` is a normal answer. Our four-value enum cannot
 * hold a pair, so the order below picks which fact to keep: the primary type
 * first where it is the specific one, because "this is a single" is what a
 * discography is split on, and compilation after that, because it is the only
 * secondary type the enum can represent and it changes how a release reads.
 */
const PRECEDENCE: readonly ReleaseType[] = ['single', 'ep', 'compilation', 'album']

export function releaseTypeOf(dto: {
  releaseTypes?: string[]
  isCompilation?: boolean
}): ReleaseType {
  const reported = new Set(
    (Array.isArray(dto.releaseTypes) ? dto.releaseTypes : [])
      .filter((type): type is string => typeof type === 'string')
      .map(type => type.trim().toLowerCase())
  )

  // A flag and a type saying the same thing is not a conflict; the flag is how
  // a server that reports no types at all still reports this one.
  if (dto.isCompilation) reported.add('compilation')

  for (const type of PRECEDENCE) {
    if (reported.has(type)) return type
  }

  // Either the server named only types this enum has no room for ("Live",
  // "Remix"), or it named none. Both read as an album, which is also what
  // every release defaulted to before this existed.
  return 'album'
}
