import { releaseTypeOf } from './releaseType'

describe('releaseTypeOf', () => {
  it('takes the type the server reports', () => {
    expect(releaseTypeOf({ releaseTypes: ['Single'] })).toBe('single')
    expect(releaseTypeOf({ releaseTypes: ['EP'] })).toBe('ep')
    expect(releaseTypeOf({ releaseTypes: ['Album'] })).toBe('album')
    expect(releaseTypeOf({ releaseTypes: ['Compilation'] })).toBe('compilation')
  })

  it('does not care how the server cases or pads it', () => {
    expect(releaseTypeOf({ releaseTypes: ['  eP '] })).toBe('ep')
    expect(releaseTypeOf({ releaseTypes: ['SINGLE'] })).toBe('single')
  })

  /**
   * MusicBrainz carries a primary and a secondary type at once, and our enum
   * holds one value — see the note in the module.
   */
  it('keeps the primary type when a secondary one comes with it', () => {
    expect(releaseTypeOf({ releaseTypes: ['Single', 'Remix'] })).toBe('single')
    expect(releaseTypeOf({ releaseTypes: ['EP', 'Live'] })).toBe('ep')
  })

  it('keeps compilation over album, since album is the one that says least', () => {
    expect(releaseTypeOf({ releaseTypes: ['Album', 'Compilation'] })).toBe('compilation')
  })

  it('reads a compilation reported only as a flag', () => {
    expect(releaseTypeOf({ isCompilation: true })).toBe('compilation')
    expect(releaseTypeOf({ releaseTypes: ['Album'], isCompilation: true })).toBe('compilation')
  })

  it('falls back to album when the types are ones the enum cannot hold', () => {
    expect(releaseTypeOf({ releaseTypes: ['Live'] })).toBe('album')
    expect(releaseTypeOf({ releaseTypes: ['Soundtrack', 'Remix'] })).toBe('album')
  })

  it('falls back to album when the server reports nothing', () => {
    expect(releaseTypeOf({})).toBe('album')
    expect(releaseTypeOf({ releaseTypes: [] })).toBe('album')
    expect(releaseTypeOf({ isCompilation: false })).toBe('album')
  })
})
