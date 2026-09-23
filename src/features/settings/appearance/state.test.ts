import reducer, {
  deleteTheme,
  editActiveTheme,
  selectActiveTheme,
  selectCoverAccentEnabled,
  selectListDensity,
  selectRadiusPreset,
  selectThemeColor,
  selectTranslucentDock,
  setActiveTheme,
  setCoverAccentEnabled,
  setRadiusPreset,
  setThemeColor,
} from './state'
import { migrateAppearance } from './themeStore'
import { DEFAULT_THEME, PRESET_THEMES } from '@/features/theme/presets'

const fresh = () => reducer(undefined, { type: '@@init' })
const root = (settingsAppearance: ReturnType<typeof fresh>) => ({ settingsAppearance })

describe('the active theme', () => {
  it('is the default theme on a fresh install', () => {
    expect(selectActiveTheme(root(fresh()))).toBe(DEFAULT_THEME)
    expect(selectRadiusPreset(root(fresh()))).toBe('default')
    expect(selectListDensity(root(fresh()))).toBe('default')
    expect(selectCoverAccentEnabled(root(fresh()))).toBe(true)
    expect(selectTranslucentDock(root(fresh()))).toBe(false)
  })

  it('switches to a preset by id, and ignores an id it does not know', () => {
    let state = reducer(fresh(), setActiveTheme('midnight'))
    expect(selectActiveTheme(root(state)).id).toBe('midnight')
    state = reducer(state, setActiveTheme('no-such-theme'))
    expect(selectActiveTheme(root(state)).id).toBe('midnight')
  })

  it('is the same object until the theme changes, so nothing redraws for nothing', () => {
    const state = fresh()
    expect(selectActiveTheme(root(state))).toBe(selectActiveTheme(root({ ...state })))
  })

  it('falls back to the default for an id whose theme is gone', () => {
    expect(selectActiveTheme(root({ ...fresh(), activeThemeId: 'custom-deleted' }))).toBe(DEFAULT_THEME)
  })
})

describe('editing', () => {
  it('copies a preset rather than changing it', () => {
    const state = reducer(fresh(), setThemeColor('#123456'))

    expect(state.customThemes).toHaveLength(1)
    expect(state.customThemes[0]).toMatchObject({ basedOn: 'yuzic', accent: '#123456' })
    expect(state.activeThemeId).toBe(state.customThemes[0].id)
    expect(PRESET_THEMES[0].accent).toBe(DEFAULT_THEME.accent)
  })

  it('keeps editing the same copy after the first change', () => {
    let state = reducer(fresh(), setThemeColor('#123456'))
    state = reducer(state, setRadiusPreset('sharp'))
    state = reducer(state, setCoverAccentEnabled(false))

    expect(state.customThemes).toHaveLength(1)
    expect(selectThemeColor(root(state))).toBe('#123456')
    expect(selectRadiusPreset(root(state))).toBe('sharp')
    expect(selectCoverAccentEnabled(root(state))).toBe(false)
  })

  it('merges a palette edit into one scheme and leaves the rest alone', () => {
    const state = reducer(fresh(), editActiveTheme({ palettes: { dark: { background: '#101010' } } }))
    const theme = selectActiveTheme(root(state))

    expect(theme.palettes.dark.background).toBe('#101010')
    expect(theme.palettes.dark.text).toBe(DEFAULT_THEME.palettes.dark.text)
    expect(theme.palettes.light).toEqual(DEFAULT_THEME.palettes.light)
  })

  it('goes back to the preset a deleted active theme came from', () => {
    let state = reducer(fresh(), setActiveTheme('forest'))
    state = reducer(state, setThemeColor('#123456'))
    state = reducer(state, deleteTheme(state.activeThemeId))

    expect(state.customThemes).toEqual([])
    expect(state.activeThemeId).toBe('forest')
  })
})

describe('upgrading from the old appearance settings', () => {
  it('puts someone who never changed them on the default theme', () => {
    const migrated = migrateAppearance({
      themeMode: 'dark', themeColor: DEFAULT_THEME.accent, radiusPreset: 'default',
      listDensity: 'default', coverAccentEnabled: true, translucentDock: false, hapticsEnabled: false,
    })

    expect(migrated).toEqual({ themeMode: 'dark', hapticsEnabled: false, activeThemeId: 'yuzic', customThemes: [] })
  })

  it('keeps every choice someone made, as a theme of their own', () => {
    const migrated = migrateAppearance({
      themeColor: '#0be881', radiusPreset: 'rounded', listDensity: 'compact',
      coverAccentEnabled: false, translucentDock: true,
    })
    const theme = selectActiveTheme(root(migrated))

    expect(theme).toMatchObject({
      basedOn: 'yuzic',
      accent: '#0be881',
      shape: { radius: 'rounded', density: 'compact' },
      surface: { coverTint: false },
      components: { dock: 'translucent' },
    })
    expect(theme.palettes).toEqual(DEFAULT_THEME.palettes)
    expect(migrated).not.toHaveProperty('themeColor')
  })

  it('leaves an already-upgraded blob alone', () => {
    const current = { ...fresh(), activeThemeId: 'paper' }
    expect(migrateAppearance(current)).toBe(current)
  })
})
