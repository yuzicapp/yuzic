import reducer, {
  editTheme,
  resetPalettes,
  selectActiveTheme,
  selectCoverAccentEnabled,
  selectListDensity,
  selectRadiusPreset,
  selectThemeColor,
  selectTranslucentDock,
  setCoverAccentEnabled,
  setRadiusPreset,
  setThemeColor,
  setTranslucentDock,
  setLiveAccent,
} from './state'
import { migrateAppearance } from './themeStore'
import { DEFAULT_THEME } from '@/features/theme/presets'

const fresh = () => reducer(undefined, { type: '@@init' })
const root = (settingsAppearance: ReturnType<typeof fresh>) => ({ settingsAppearance })

describe('the theme', () => {
  it('is the default look on a fresh install', () => {
    expect(selectActiveTheme(root(fresh()))).toEqual(DEFAULT_THEME)
    expect(selectRadiusPreset(root(fresh()))).toBe('default')
    expect(selectListDensity(root(fresh()))).toBe('default')
    expect(selectCoverAccentEnabled(root(fresh()))).toBe(true)
    expect(selectTranslucentDock(root(fresh()))).toBe(false)
  })

  it('is the same object until it changes, so nothing redraws for nothing', () => {
    const state = fresh()
    expect(selectActiveTheme(root(state))).toBe(selectActiveTheme(root({ ...state })))
  })

  it('takes every setter as an edit of the one theme', () => {
    let state = reducer(fresh(), setThemeColor('#123456'))
    state = reducer(state, setRadiusPreset('sharp'))
    state = reducer(state, setCoverAccentEnabled(false))
    state = reducer(state, setTranslucentDock(true))

    expect(selectThemeColor(root(state))).toBe('#123456')
    expect(selectRadiusPreset(root(state))).toBe('sharp')
    expect(selectCoverAccentEnabled(root(state))).toBe(false)
    expect(selectTranslucentDock(root(state))).toBe(true)
  })

  it('merges a palette edit into one scheme and leaves the rest alone', () => {
    const state = reducer(fresh(), editTheme({ palettes: { dark: { background: '#101010' } } }))
    const theme = selectActiveTheme(root(state))

    expect(theme.palettes.dark.background).toBe('#101010')
    expect(theme.palettes.dark.text).toBe(DEFAULT_THEME.palettes.dark.text)
    expect(theme.palettes.light).toEqual(DEFAULT_THEME.palettes.light)
  })

  it('resets the colours without touching the accent', () => {
    let state = reducer(fresh(), editTheme({ accent: '#123456', palettes: { dark: { background: '#101010' } } }))
    state = reducer(state, resetPalettes())

    expect(selectActiveTheme(root(state)).palettes).toEqual(DEFAULT_THEME.palettes)
    expect(selectThemeColor(root(state))).toBe('#123456')
  })
})

describe('upgrading from the old appearance settings', () => {
  it('keeps every choice someone made, over the default look', () => {
    const migrated = migrateAppearance({
      themeMode: 'dark', themeColor: '#0be881', radiusPreset: 'rounded', listDensity: 'compact',
      coverAccentEnabled: false, translucentDock: true, hapticsEnabled: false,
    })

    expect(migrated.theme).toMatchObject({
      accent: '#0be881',
      shape: { radius: 'rounded', density: 'compact' },
      surface: { coverTint: false },
      components: { dock: 'translucent' },
    })
    expect(migrated.theme.palettes).toEqual(DEFAULT_THEME.palettes)
    expect(migrated).toMatchObject({ themeMode: 'dark', hapticsEnabled: false })
    expect(migrated).not.toHaveProperty('themeColor')
  })

  it('carries the active theme across from a build that stored several', () => {
    const migrated = migrateAppearance({
      activeThemeId: 'custom-1',
      customThemes: [{ ...DEFAULT_THEME, id: 'custom-1', accent: '#abcdef' }],
    })

    expect(migrated.theme.accent).toBe('#abcdef')
    expect(migrated).not.toHaveProperty('customThemes')
    expect(migrated).not.toHaveProperty('activeThemeId')
  })

  it('leaves an already-upgraded blob alone', () => {
    const current = fresh()
    expect(migrateAppearance(current)).toBe(current)
  })
})

describe('an accent from what is playing', () => {
  it('stands in for the theme accent only while the theme follows the cover', () => {
    let state = reducer(fresh(), setLiveAccent('#336699'))
    expect(selectThemeColor(root(state))).toBe(DEFAULT_THEME.accent)

    state = reducer(state, editTheme({ accentFromCover: true }))
    expect(selectThemeColor(root(state))).toBe('#336699')

    state = reducer(state, setLiveAccent(null))
    expect(selectThemeColor(root(state))).toBe(DEFAULT_THEME.accent)
  })

  it('stops following the cover when an accent is picked', () => {
    let state = reducer(fresh(), editTheme({ accentFromCover: true }))
    state = reducer(state, setLiveAccent('#336699'))
    state = reducer(state, setThemeColor('#123456'))

    expect(selectActiveTheme(root(state)).accentFromCover).toBe(false)
    expect(selectThemeColor(root(state))).toBe('#123456')
  })
})
